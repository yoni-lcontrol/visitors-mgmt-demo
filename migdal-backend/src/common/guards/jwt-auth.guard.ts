import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_KIOSK_KEY } from '../decorators/kiosk-auth.decorator';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        const isKiosk = this.reflector.getAllAndOverride<boolean>(IS_KIOSK_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic || isKiosk) {
            return true;
        }

        return super.canActivate(context);
    }

    handleRequest<T>(err: Error | null, user: T, info: Error | undefined): T {
        if (err || !user) {
            throw err || new UnauthorizedException('Invalid or expired token');
        }
        return user;
    }
}
