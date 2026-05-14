import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IS_KIOSK_KEY } from '../decorators/kiosk-auth.decorator';

@Injectable()
export class KioskApiKeyGuard implements CanActivate {
    private readonly kioskApiKey: string;

    constructor(
        private readonly reflector: Reflector,
        private readonly configService: ConfigService,
    ) {
        this.kioskApiKey = this.configService.get<string>('KIOSK_API_KEY', 'kiosk-dev-key');
    }

    canActivate(context: ExecutionContext): boolean {
        const isKiosk = this.reflector.getAllAndOverride<boolean>(IS_KIOSK_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!isKiosk) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers['x-kiosk-api-key'];

        if (!apiKey || apiKey !== this.kioskApiKey) {
            throw new UnauthorizedException('Invalid or missing kiosk API key');
        }

        return true;
    }
}
