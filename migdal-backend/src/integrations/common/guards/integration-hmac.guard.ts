import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
    Logger,
    RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { IntegrationAuthService } from '../services/integration-auth.service';

@Injectable()
export class IntegrationHmacGuard implements CanActivate {
    private readonly logger = new Logger(IntegrationHmacGuard.name);

    constructor(private readonly authService: IntegrationAuthService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();

        const clientId = request.headers['x-client-id'] as string | undefined;
        const timestamp = request.headers['x-timestamp'] as string | undefined;
        const signature = request.headers['x-signature'] as string | undefined;

        if (!clientId || !timestamp || !signature) {
            throw new UnauthorizedException('Missing required integration headers: x-client-id, x-timestamp, x-signature');
        }

        const client = this.authService.getClient(clientId);
        if (!client) {
            throw new UnauthorizedException('Unknown or disabled integration client');
        }

        if (!this.authService.isTimestampValid(timestamp)) {
            throw new UnauthorizedException('Request timestamp is expired or invalid');
        }

        const rawBody = request.rawBody?.toString();
        if (!rawBody) {
            throw new UnauthorizedException('Raw body not available for signature verification');
        }

        try {
            const valid = this.authService.verifySignature(clientId, timestamp, rawBody, signature);
            if (!valid) {
                throw new UnauthorizedException('Invalid HMAC signature');
            }
        } catch (err) {
            if (err instanceof UnauthorizedException) throw err;
            this.logger.warn(`Signature verification failed for client ${clientId}`);
            throw new UnauthorizedException('Invalid HMAC signature');
        }

        // Attach client info to request for downstream usage
        (request as any).integrationClient = client;
        return true;
    }
}
