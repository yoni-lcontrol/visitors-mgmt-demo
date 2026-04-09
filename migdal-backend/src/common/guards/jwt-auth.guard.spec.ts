import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;
    let reflector: Reflector;

    beforeEach(() => {
        reflector = new Reflector();
        guard = new JwtAuthGuard(reflector);
    });

    function createMockContext(isPublic: boolean): ExecutionContext {
        const handler = jest.fn();
        const cls = jest.fn();
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
        return {
            getHandler: () => handler,
            getClass: () => cls,
            switchToHttp: () => ({
                getRequest: () => ({}),
                getResponse: () => ({}),
                getNext: () => jest.fn(),
            }),
            getType: () => 'http',
            getArgs: () => [],
            getArgByIndex: () => undefined,
            switchToRpc: () => ({} as any),
            switchToWs: () => ({} as any),
        } as unknown as ExecutionContext;
    }

    it('should allow public routes without token', () => {
        const context = createMockContext(true);
        expect(guard.canActivate(context)).toBe(true);
    });

    it('should reject unauthenticated requests on protected routes via handleRequest', () => {
        expect(() => guard.handleRequest(null, null as any, undefined)).toThrow(
            UnauthorizedException,
        );
    });

    it('should reject with error via handleRequest', () => {
        const err = new Error('Token malformed');
        expect(() => guard.handleRequest(err, null as any, undefined)).toThrow(err);
    });

    it('should return user when valid via handleRequest', () => {
        const user = { sub: 'u1', username: 'admin', roles: ['Admin'], permissions: ['users.read'] };
        expect(guard.handleRequest(null, user, undefined)).toEqual(user);
    });

    it('should reject expired token with proper message via handleRequest', () => {
        try {
            guard.handleRequest(null, null as any, new Error('jwt expired'));
            fail('Expected UnauthorizedException');
        } catch (e: any) {
            expect(e).toBeInstanceOf(UnauthorizedException);
            expect(e.message).toBe('Invalid or expired token');
        }
    });

    it('should reject malformed token with proper message via handleRequest', () => {
        try {
            guard.handleRequest(null, null as any, new Error('invalid signature'));
            fail('Expected UnauthorizedException');
        } catch (e: any) {
            expect(e).toBeInstanceOf(UnauthorizedException);
            expect(e.message).toBe('Invalid or expired token');
        }
    });
});
