import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { IntegrationHmacGuard } from './integration-hmac.guard';
import { IntegrationProvider } from '../enums/integration-provider.enum';

describe('IntegrationHmacGuard', () => {
    let guard: IntegrationHmacGuard;
    let authService: {
        getClient: jest.Mock;
        isTimestampValid: jest.Mock;
        verifySignature: jest.Mock;
    };

    const createMockExecutionContext = (headers: Record<string, string>, rawBody?: string): ExecutionContext => {
        const request: any = {
            headers,
            rawBody,
        };
        return {
            switchToHttp: () => ({
                getRequest: () => request,
            }),
        } as ExecutionContext;
    };

    beforeEach(() => {
        authService = {
            getClient: jest.fn(),
            isTimestampValid: jest.fn(),
            verifySignature: jest.fn(),
        };
        guard = new IntegrationHmacGuard(authService as any);
    });

    const validHeaders = {
        'x-client-id': 'client-1',
        'x-timestamp': '1700000000000',
        'x-signature': 'a'.repeat(64),
    };

    const mockClient = {
        clientId: 'client-1',
        provider: IntegrationProvider.AccessControl,
        secret: 'secret',
        enabled: true,
    };

    it('should allow request with valid HMAC', () => {
        authService.getClient!.mockReturnValue(mockClient);
        authService.isTimestampValid!.mockReturnValue(true);
        authService.verifySignature!.mockReturnValue(true);

        const ctx = createMockExecutionContext(validHeaders, '{"test":"data"}');
        expect(guard.canActivate(ctx)).toBe(true);

        const req = ctx.switchToHttp().getRequest();
        expect((req as any).integrationClient).toEqual(mockClient);
    });

    it('should throw when x-client-id is missing', () => {
        const headers = { ...validHeaders };
        delete (headers as any)['x-client-id'];
        const ctx = createMockExecutionContext(headers, '{}');

        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('should throw when x-timestamp is missing', () => {
        const headers = { ...validHeaders };
        delete (headers as any)['x-timestamp'];
        const ctx = createMockExecutionContext(headers, '{}');

        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('should throw when x-signature is missing', () => {
        const headers = { ...validHeaders };
        delete (headers as any)['x-signature'];
        const ctx = createMockExecutionContext(headers, '{}');

        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('should throw for unknown client', () => {
        authService.getClient!.mockReturnValue(undefined);
        const ctx = createMockExecutionContext(validHeaders, '{}');

        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(ctx)).toThrow('Unknown or disabled integration client');
    });

    it('should throw for expired timestamp', () => {
        authService.getClient!.mockReturnValue(mockClient);
        authService.isTimestampValid!.mockReturnValue(false);
        const ctx = createMockExecutionContext(validHeaders, '{}');

        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(ctx)).toThrow('Request timestamp is expired or invalid');
    });

    it('should throw when rawBody is not available', () => {
        authService.getClient!.mockReturnValue(mockClient);
        authService.isTimestampValid!.mockReturnValue(true);
        const ctx = createMockExecutionContext(validHeaders); // no rawBody

        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(ctx)).toThrow('Raw body not available');
    });

    it('should throw for invalid signature', () => {
        authService.getClient!.mockReturnValue(mockClient);
        authService.isTimestampValid!.mockReturnValue(true);
        authService.verifySignature!.mockReturnValue(false);
        const ctx = createMockExecutionContext(validHeaders, '{}');

        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(ctx)).toThrow('Invalid HMAC signature');
    });

    it('should catch signature verification errors and throw UnauthorizedException', () => {
        authService.getClient!.mockReturnValue(mockClient);
        authService.isTimestampValid!.mockReturnValue(true);
        authService.verifySignature!.mockImplementation(() => { throw new Error('Buffer length mismatch'); });
        const ctx = createMockExecutionContext(validHeaders, '{}');

        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
});
