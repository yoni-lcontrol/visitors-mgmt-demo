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

export type EntraUnknownUserMode = 'deny' | 'pending' | 'autoProvision';

export interface EntraConfig {
    tenantId: string;
    clientId: string;
    authority: string;
    redirectUri: string;
    postLogoutRedirectUri: string;
    apiAudience: string;
    autoProvision: boolean;
    defaultRole: string;
    unknownUserMode: EntraUnknownUserMode;
}

@Injectable()
export class EntraIdService {
    private readonly logger = new Logger(EntraIdService.name);
    private jwksClient: JwksClient | null = null;

    constructor(private readonly configService: ConfigService) { }

    getConfig(): EntraConfig {
        const tenantId = this.configService.get<string>('ENTRA_TENANT_ID', '');
        const clientId = this.configService.get<string>('ENTRA_CLIENT_ID', '');
        const authority = this.configService.get<string>(
            'ENTRA_AUTHORITY',
            tenantId ? `https://login.microsoftonline.com/${tenantId}` : '',
        );
        const autoProvision = this.configService.get<string>('ENTRA_AUTO_PROVISION', 'false') === 'true';
        const configuredUnknownUserMode = this.configService.get<string>('ENTRA_UNKNOWN_USER_MODE', '').trim();

        let unknownUserMode: EntraUnknownUserMode = 'deny';
        if (configuredUnknownUserMode === 'pending' || configuredUnknownUserMode === 'autoProvision' || configuredUnknownUserMode === 'deny') {
            unknownUserMode = configuredUnknownUserMode;
        } else if (autoProvision) {
            // Backward compatibility for deployments that only set ENTRA_AUTO_PROVISION.
            unknownUserMode = 'autoProvision';
        }

        return {
            tenantId,
            clientId,
            authority,
            redirectUri: this.configService.get<string>('ENTRA_REDIRECT_URI', ''),
            postLogoutRedirectUri: this.configService.get<string>('ENTRA_POST_LOGOUT_REDIRECT_URI', ''),
            apiAudience: this.configService.get<string>('ENTRA_API_AUDIENCE', this.configService.get<string>('APP_ID_URI', clientId)),
            autoProvision,
            defaultRole: this.configService.get<string>('ENTRA_DEFAULT_ROLE', 'Viewer'),
            unknownUserMode,
        };
    }

    isConfigured(): boolean {
        const config = this.getConfig();
        return !!(config.tenantId && config.clientId);
    }

    async validateAccessToken(accessToken: string): Promise<EntraTokenClaims> {
        const config = this.getConfig();
        if (!this.isConfigured()) {
            throw new UnauthorizedException('Microsoft Entra ID is not configured');
        }

        const client = this.getJwksClient(config.tenantId);

        const decoded = jwt.decode(accessToken, { complete: true });
        if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
            throw new UnauthorizedException('Invalid Entra token format');
        }

        const signingKey = await this.getSigningKey(client, decoded.header.kid);

        const audienceCandidates = [config.apiAudience, config.clientId].filter(
            (value, index, source): value is string => !!value && source.indexOf(value) === index,
        );
        const audiences: string | [string, ...string[]] =
            audienceCandidates.length > 1
                ? [audienceCandidates[0], ...audienceCandidates.slice(1)]
                : audienceCandidates[0] ?? config.clientId;

        const trustedIssuers: [string, ...string[]] = [
            `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
            `https://sts.windows.net/${config.tenantId}/`,
        ];

        try {
            const payload = jwt.verify(accessToken, signingKey, {
                audience: audiences,
                issuer: trustedIssuers,
                algorithms: ['RS256'],
            });

            if (typeof payload === 'string') {
                throw new UnauthorizedException('Invalid ID token payload');
            }

            const claims = payload as Record<string, unknown>;

            if (!claims.oid || typeof claims.oid !== 'string') {
                throw new UnauthorizedException('Missing oid claim in token');
            }

            if (!claims.tid || typeof claims.tid !== 'string') {
                throw new UnauthorizedException('Missing tid claim in token');
            }

            if (claims.tid !== config.tenantId) {
                throw new UnauthorizedException('Token tenant is not allowed');
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
            throw new UnauthorizedException('Invalid or expired Entra access token');
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
