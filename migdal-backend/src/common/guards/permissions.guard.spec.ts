import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
    let guard: PermissionsGuard;
    let reflector: Reflector;

    beforeEach(() => {
        reflector = new Reflector();
        guard = new PermissionsGuard(reflector);
    });

    function createContext(
        permissions: string[] | undefined,
        user: { permissions?: string[] } | null,
    ): ExecutionContext {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(permissions ?? undefined);
        return {
            getHandler: () => jest.fn(),
            getClass: () => jest.fn(),
            switchToHttp: () => ({
                getRequest: () => ({ user }),
            }),
        } as unknown as ExecutionContext;
    }

    it('should allow when no permissions required', () => {
        const ctx = createContext(undefined, { permissions: [] });
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow when empty permissions array required', () => {
        const ctx = createContext([], { permissions: [] });
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow when user has all required permissions', () => {
        const ctx = createContext(
            ['users.read', 'users.create'],
            { permissions: ['users.read', 'users.create', 'users.update'] },
        );
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should throw ForbiddenException when permission is missing', () => {
        const ctx = createContext(
            ['users.update'],
            { permissions: ['users.read'] },
        );
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException (not UnauthorizedException) for missing permissions', () => {
        const ctx = createContext(
            ['users.update'],
            { permissions: ['users.read'] },
        );
        try {
            guard.canActivate(ctx);
            fail('Expected ForbiddenException');
        } catch (e: any) {
            expect(e).toBeInstanceOf(ForbiddenException);
            // Must NOT be 401
            expect(e.getStatus()).toBe(403);
        }
    });

    it('should throw ForbiddenException when user has no permissions array', () => {
        const ctx = createContext(['users.read'], { permissions: undefined });
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when no user on request', () => {
        const ctx = createContext(['users.read'], null);
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
});
