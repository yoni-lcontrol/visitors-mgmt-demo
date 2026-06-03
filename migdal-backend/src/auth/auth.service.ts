import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client as LdapClient } from 'ldapts';
import { RefreshToken } from './entities/refresh-token.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { EntraIdService } from './entra-id.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { hashPassword, comparePassword } from '../common/utils/hash.util';
import { ErrorMessages } from '../common/constants/error-messages.constants';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    private mapUserResponse(user: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        email?: string | null;
        phone?: string | null;
        sector?: { id: string; name: string } | null;
        role: { id: string; name: string; permissions: { key: string }[] } | null;
        roles?: Array<{ id: string; name: string; permissions?: { key: string }[] }>;
    }) {
        return {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email ?? null,
            phone: user.phone ?? null,
            sector: user.sector ? { id: user.sector.id, name: user.sector.name } : null,
            roles: this.extractRoleNames(user),
            permissions: this.extractPermissions(user),
        };
    }

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly usersService: UsersService,
        private readonly auditService: AuditService,
        private readonly entraIdService: EntraIdService,
        @InjectRepository(RefreshToken)
        private readonly refreshTokenRepo: Repository<RefreshToken>,
        @InjectRepository(AdConfiguration)
        private readonly adConfigRepo: Repository<AdConfiguration>,
    ) { }

    async login(
        dto: LoginDto,
        userAgent?: string,
        ipAddress?: string,
    ): Promise<LoginResponseDto> {
        const user = await this.usersService.findByUsername(dto.username);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Determine authentication method based on user's sync source
        if (user.syncSource === 'ad' && user.adSourceId) {
            // AD user: authenticate via LDAP bind
            await this.authenticateViaLdap(user.adSourceId, dto.username, dto.password);
        } else {
            // Local user: authenticate via stored password hash
            if (!user.passwordHash) {
                throw new UnauthorizedException('Invalid credentials');
            }
            const passwordValid = await comparePassword(dto.password, user.passwordHash);
            if (!passwordValid) {
                throw new UnauthorizedException('Invalid credentials');
            }
        }

        if (!user.isActive) {
            throw new UnauthorizedException(ErrorMessages.USER_INACTIVE);
        }

        // Update last login
        await this.usersService.updateLastLogin(user.id);

        // Generate tokens
        const { accessToken: localAccessToken, refreshToken } = await this.generateTokens(
            user,
            userAgent,
            ipAddress,
        );

        this.auditService.log({
            userId: user.id,
            module: 'auth',
            action: 'LOGIN',
            entity: 'User',
            entityId: user.id,
            description: `User ${user.username} logged in${user.syncSource === 'ad' ? ' (AD)' : ''}`,
            performedByEmail: user.email ?? null,
            ipAddress,
            userAgent,
        }).catch(() => { });

        return {
            accessToken: localAccessToken,
            refreshToken,
            user: this.mapUserResponse(user),
        };
    }

    private async authenticateViaLdap(adSourceId: string, username: string, password: string): Promise<void> {
        const adConfig = await this.adConfigRepo.findOne({ where: { id: adSourceId, isActive: true } });
        if (!adConfig) {
            this.logger.warn(`AD configuration not found or inactive for adSourceId=${adSourceId}`);
            throw new UnauthorizedException('Invalid credentials');
        }

        const port = adConfig.port || 389;
        let url: string;
        if (adConfig.useSsl) {
            const rawUrl = adConfig.ldapUrl.startsWith('ldap') ? adConfig.ldapUrl : `ldap://${adConfig.ldapUrl}`;
            url = `ldaps://${new URL(rawUrl).hostname}:${port}`;
        } else if (adConfig.ldapUrl.includes('://')) {
            try {
                const parsed = new URL(adConfig.ldapUrl);
                url = `${parsed.protocol}//${parsed.hostname}:${port}`;
            } catch {
                url = `ldap://${adConfig.ldapUrl}:${port}`;
            }
        } else {
            url = `ldap://${adConfig.ldapUrl}:${port}`;
        }

        const client = new LdapClient({
            url,
            tlsOptions: adConfig.useSsl ? { rejectUnauthorized: false } : undefined,
        });

        // Bind with the user's own credentials
        const userBindDn = username.includes('@') || username.includes('\\')
            ? username
            : `${username}@${adConfig.domain}`;

        try {
            await client.bind(userBindDn, password);
        } catch (err) {
            this.logger.debug(`LDAP bind failed for user ${username}: ${(err as Error).message}`);
            throw new UnauthorizedException('Invalid credentials');
        } finally {
            try { await client.unbind(); } catch { /* ignore unbind errors */ }
        }
    }

    async logout(userId: string, refreshTokenValue?: string): Promise<void> {
        if (refreshTokenValue) {
            const hash = this.hashToken(refreshTokenValue);
            await this.refreshTokenRepo.update(
                { userId, tokenHash: hash },
                { isRevoked: true },
            );
        } else {
            // Revoke all refresh tokens for this user
            await this.refreshTokenRepo.update({ userId }, { isRevoked: true });
        }

        this.auditService.log({
            userId,
            module: 'auth',
            action: 'LOGOUT',
            entity: 'User',
            entityId: userId,
            description: 'User logged out',
        }).catch(() => { });
    }

    async refreshTokens(
        oldRefreshToken: string,
        userAgent?: string,
        ipAddress?: string,
    ): Promise<{ accessToken: string; refreshToken: string; user: { id: string; username: string; firstName: string; lastName: string; email: string | null; phone: string | null; sector: { id: string; name: string } | null; roles: string[]; permissions: string[] } }> {
        const hash = this.hashToken(oldRefreshToken);
        const storedToken = await this.refreshTokenRepo.findOne({
            where: { tokenHash: hash, isRevoked: false },
        });

        if (!storedToken || storedToken.expiresAt < new Date()) {
            this.logger.warn(`Refresh token rejected – hash not found or expired (userId from stored: ${storedToken?.userId ?? 'N/A'})`);
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        // Revoke old refresh token (rotation)
        await this.refreshTokenRepo.update(storedToken.id, { isRevoked: true });

        const user = await this.usersService.findById(storedToken.userId);
        if (!user || !user.isActive) {
            throw new UnauthorizedException(ErrorMessages.USER_INACTIVE);
        }

        const tokens = await this.generateTokens(user, userAgent, ipAddress);

        return {
            ...tokens,
            user: this.mapUserResponse(user),
        };
    }

    async getCurrentUser(userId: string) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return this.mapUserResponse(user);
    }

    private async generateTokens(
        user: {
            id: string;
            username: string;
            role: { id: string; name: string; permissions: { key: string }[] } | null;
            roles?: Array<{ id: string; name: string; permissions?: { key: string }[] }>;
        },
        userAgent?: string,
        ipAddress?: string,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const permissions = this.extractPermissions(user);

        const payload: JwtPayload = {
            sub: user.id,
            username: user.username,
            roles: this.extractRoleNames(user),
            roleIds: this.extractRoleIds(user),
            permissions,
        };

        const accessToken = this.jwtService.sign(payload);

        // Generate refresh token
        const refreshTokenValue = uuidv4();
        const tokenHash = this.hashToken(refreshTokenValue);
        const refreshDays = this.configService.get<number>('JWT_REFRESH_EXPIRATION_DAYS', 7);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + refreshDays);

        await this.refreshTokenRepo.save({
            userId: user.id,
            tokenHash,
            expiresAt,
            userAgent: userAgent ?? null,
            ipAddress: ipAddress ?? null,
        });

        return { accessToken, refreshToken: refreshTokenValue };
    }

    private extractPermissions(
        user: {
            role: { permissions: { key: string }[] } | null;
            roles?: Array<{ permissions?: { key: string }[] }>;
        },
    ): string[] {
        const permSet = new Set<string>();

        const roles = user.roles && user.roles.length > 0
            ? user.roles
            : (user.role ? [user.role] : []);

        for (const role of roles) {
            for (const perm of role.permissions ?? []) {
                permSet.add(perm.key);
            }
        }

        return [...permSet];
    }

    private extractRoleNames(
        user: {
            role: { id: string; name: string } | null;
            roles?: Array<{ id: string; name: string }>;
        },
    ): string[] {
        const roles = user.roles && user.roles.length > 0
            ? user.roles
            : (user.role ? [user.role] : []);

        return roles.map((r) => r.name);
    }

    private extractRoleIds(
        user: {
            role: { id: string; name: string } | null;
            roles?: Array<{ id: string; name: string }>;
        },
    ): string[] {
        const roles = user.roles && user.roles.length > 0
            ? user.roles
            : (user.role ? [user.role] : []);

        return roles.map((r) => r.id);
    }

    private hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    /** Cleanup expired and revoked tokens */
    async cleanupExpiredTokens(): Promise<number> {
        const result = await this.refreshTokenRepo
            .createQueryBuilder()
            .delete()
            .from(RefreshToken)
            .where('expiresAt < :now', { now: new Date() })
            .orWhere('isRevoked = :revoked', { revoked: true })
            .execute();
        return result.affected ?? 0;
    }

    async loginWithEntra(
        accessToken: string,
        userAgent?: string,
        ipAddress?: string,
    ): Promise<LoginResponseDto> {
        const claims = await this.entraIdService.validateAccessToken(accessToken);
        const config = this.entraIdService.getConfig();

        // 1. Try to find user by Entra identity (oid + tid)
        let user = await this.usersService.findByExternalIdentity(claims.oid, claims.tid);

        // 2. Fallback: find by email/UPN
        if (!user) {
            const email = this.entraIdService.extractEmail(claims);
            if (email) {
                user = await this.usersService.findByEmail(email);
                if (user) {
                    // Link the external identity to this existing user
                    await this.usersService.linkExternalAuth(user.id, {
                        provider: 'entra',
                        externalId: claims.oid,
                        tenantId: claims.tid,
                        displayName: claims.name,
                        email,
                    });
                }
            }
        }

        // 3. Unknown-user policy: autoProvision | pending | deny
        if (!user && config.unknownUserMode === 'autoProvision') {
            const email = this.entraIdService.extractEmail(claims);
            const { firstName, lastName } = this.entraIdService.extractDisplayName(claims);
            const username = claims.upn ?? claims.preferred_username ?? email ?? claims.oid;

            user = await this.usersService.createExternalUser({
                username,
                firstName,
                lastName,
                displayName: claims.name ?? `${firstName} ${lastName}`.trim(),
                email: email ?? null,
                externalAuthProvider: 'entra',
                externalAuthId: claims.oid,
                externalTenantId: claims.tid,
                roleNames: [config.defaultRole],
            });
        }

        if (!user && config.unknownUserMode === 'pending') {
            await this.usersService.createPendingExternalUser({
                oid: claims.oid,
                tid: claims.tid,
                preferredUsername: claims.preferred_username ?? claims.upn ?? null,
                email: this.entraIdService.extractEmail(claims),
                displayName: claims.name ?? null,
            });

            throw new UnauthorizedException(
                'No matching local account found. Your sign-in request is pending administrator approval.',
            );
        }

        if (!user) {
            throw new UnauthorizedException(
                'No matching local account found. Contact your administrator.',
            );
        }

        if (!user.isActive) {
            throw new UnauthorizedException(ErrorMessages.USER_INACTIVE);
        }

        // Update external login timestamp
        await this.usersService.updateLastExternalLogin(user.id, {
            displayName: claims.name,
            email: this.entraIdService.extractEmail(claims),
        });

        // Generate local app tokens (same as password login)
        const { accessToken: localAccessToken, refreshToken } = await this.generateTokens(
            user,
            userAgent,
            ipAddress,
        );

        this.auditService.log({
            userId: user.id,
            module: 'auth',
            action: 'ENTRA_LOGIN',
            entity: 'User',
            entityId: user.id,
            description: `User ${user.username} logged in via Microsoft Entra ID`,
            ipAddress,
            userAgent,
        }).catch(() => { });

        return {
            accessToken: localAccessToken,
            refreshToken,
            user: this.mapUserResponse(user),
        };
    }
}
