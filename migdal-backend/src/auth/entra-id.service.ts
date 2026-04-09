import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwksClient } from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';

export interface EntraTokenClaims {
    /** Object ID — unique per user in the tenant */
    oid: string;
    /** User Principal Name (e.g. user@domain.com) */
    upn?: string;
    /** Preferred username (often same as UPN) */
    preferred_username?: string;
    /** Email address */
    email?: string;
    /** Given name */
    given_name?: string;
    /** Family name */
    family_name?: string;
    /** Display name */
    name?: string;
    /** Tenant ID */
    tid: string;
}

export interface EntraConfig {
    tenantId: string;
    clientId: string;
    redirectUri: string;
    autoProvision: boolean;
    defaultRole: string;
}

@Injectable()
export class EntraIdService {
    private readonly logger = new Logger(EntraIdService.name);
    private jwksClient: JwksClient | null = null;

    constructor(private readonly configService: ConfigService) { }

    getConfig(): EntraConfig {
        return {
            tenantId: this.configService.get<string>('ENTRA_TENANT_ID', ''),
            clientId: this.configService.get<string>('ENTRA_CLIENT_ID', ''),
            redirectUri: this.configService.get<string>('ENTRA_REDIRECT_URI', ''),
            autoProvision: this.configService.get<string>('ENTRA_AUTO_PROVISION', 'false') === 'true',
            defaultRole: this.configService.get<string>('ENTRA_DEFAULT_ROLE', 'Viewer'),
        };
    }

    isConfigured(): boolean {
        const config = this.getConfig();
        return !!(config.tenantId && config.clientId);
    }

    async validateIdToken(idToken: string): Promise<EntraTokenClaims> {
        const config = this.getConfig();
        if (!this.isConfigured()) {
            throw new UnauthorizedException('Microsoft Entra ID is not configured');
        }

        const client = this.getJwksClient(config.tenantId);

        const decoded = jwt.decode(idToken, { complete: true });
        if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
            throw new UnauthorizedException('Invalid ID token format');
        }

        const signingKey = await this.getSigningKey(client, decoded.header.kid);

        try {
            const payload = jwt.verify(idToken, signingKey, {
                audience: config.clientId,
                issuer: [
                    `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
                    `https://sts.windows.net/${config.tenantId}/`,
                ],
                algorithms: ['RS256'],
            });

            if (typeof payload === 'string') {
                throw new UnauthorizedException('Invalid ID token payload');
            }

            const claims = payload as Record<string, unknown>;

            if (!claims.oid || typeof claims.oid !== 'string') {
                throw new UnauthorizedException('Missing oid claim in ID token');
            }

            this.logger.log(`Entra ID token validated for oid: ${claims.oid}`);

            return {
                oid: claims.oid as string,
                upn: (claims.upn as string) ?? undefined,
                preferred_username: (claims.preferred_username as string) ?? undefined,
                email: (claims.email as string) ?? undefined,
                given_name: (claims.given_name as string) ?? undefined,
                family_name: (claims.family_name as string) ?? undefined,
                name: (claims.name as string) ?? undefined,
                tid: (claims.tid as string) ?? config.tenantId,
            };
        } catch (err) {
            if (err instanceof UnauthorizedException) throw err;

            const message = err instanceof Error ? err.message : 'Token verification failed';
            this.logger.warn(`Entra ID token validation failed: ${message}`);
            throw new UnauthorizedException('Invalid or expired ID token');
        }
    }

    extractEmail(claims: EntraTokenClaims): string | null {
        return claims.email ?? claims.upn ?? claims.preferred_username ?? null;
    }

    extractDisplayName(claims: EntraTokenClaims): { firstName: string; lastName: string } {
        if (claims.given_name && claims.family_name) {
            return { firstName: claims.given_name, lastName: claims.family_name };
        }
        if (claims.name) {
            const parts = claims.name.split(' ');
            return {
                firstName: parts[0] || 'Unknown',
                lastName: parts.slice(1).join(' ') || 'User',
            };
        }
        return { firstName: 'Unknown', lastName: 'User' };
    }

    private getJwksClient(tenantId: string): JwksClient {
        if (!this.jwksClient) {
            this.jwksClient = new JwksClient({
                jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
                cache: true,
                cacheMaxAge: 86400000, // 24 hours
                rateLimit: true,
            });
        }
        return this.jwksClient;
    }

    private async getSigningKey(client: JwksClient, kid: string): Promise<string> {
        try {
            const key = await client.getSigningKey(kid);
            return key.getPublicKey();
        } catch {
            throw new UnauthorizedException('Unable to verify token signature');
        }
    }
}
