import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { sso } from 'node-expose-sspi';
import { KerberosService } from '../kerberos.service';

/**
 * Wraps node-expose-sspi's `sso.auth()` Express middleware, which drives the
 * full SPNEGO/NTLM Negotiate handshake (including intermediate 401 challenge
 * round-trips) and populates `req.sso.user` on success. A no-op unless
 * KERBEROS_ENABLED=true, so it's inert on any deployment that hasn't turned it on.
 */
@Injectable()
export class KerberosSsoMiddleware implements NestMiddleware {
    private readonly ssoAuth = sso.auth({ useActiveDirectory: true, useGroups: false });

    constructor(private readonly kerberosService: KerberosService) { }

    use(req: Request, res: Response, next: NextFunction): void {
        if (!this.kerberosService.isConfigured()) {
            next(new UnauthorizedException('Kerberos SSO is not enabled'));
            return;
        }

        this.ssoAuth(req, res, (err?: unknown) => {
            if (err) {
                const message = err instanceof Error ? err.message : 'Kerberos authentication failed';
                next(new UnauthorizedException(message));
                return;
            }
            next();
        });
    }
}
