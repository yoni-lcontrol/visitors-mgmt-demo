import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, Subject, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

describe('authInterceptor', () => {
    let httpClient: HttpClient;
    let httpMock: HttpTestingController;
    let tokenService: jasmine.SpyObj<TokenService>;
    let authService: jasmine.SpyObj<AuthService>;
    let router: jasmine.SpyObj<Router>;

    beforeEach(() => {
        tokenService = jasmine.createSpyObj('TokenService', [
            'getAccessToken',
            'setAccessToken',
            'clearAccessToken',
            'hasToken',
        ]);
        authService = jasmine.createSpyObj('AuthService', [
            'refreshToken',
            'handleAuthFailure',
        ]);
        router = jasmine.createSpyObj('Router', ['navigate']);

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([authInterceptor])),
                provideHttpClientTesting(),
                { provide: TokenService, useValue: tokenService },
                { provide: AuthService, useValue: authService },
                { provide: Router, useValue: router },
            ],
        });

        httpClient = TestBed.inject(HttpClient);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should attach access token to protected requests', () => {
        tokenService.getAccessToken.and.returnValue('test-token');

        httpClient.get('/api/users').subscribe();

        const req = httpMock.expectOne('/api/users');
        expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
        req.flush([]);
    });

    it('should not attach token when no token exists', () => {
        tokenService.getAccessToken.and.returnValue(null);

        httpClient.get('/api/users').subscribe();

        const req = httpMock.expectOne('/api/users');
        expect(req.request.headers.has('Authorization')).toBeFalse();
        req.flush([]);
    });

    it('should not attach token to auth login endpoint', () => {
        tokenService.getAccessToken.and.returnValue('test-token');

        httpClient.post('/api/auth/login', {}).subscribe();

        const req = httpMock.expectOne('/api/auth/login');
        expect(req.request.headers.has('Authorization')).toBeFalse();
        req.flush({});
    });

    it('should not attach token to auth refresh endpoint', () => {
        tokenService.getAccessToken.and.returnValue('test-token');

        httpClient.post('/api/auth/refresh', {}).subscribe();

        const req = httpMock.expectOne('/api/auth/refresh');
        expect(req.request.headers.has('Authorization')).toBeFalse();
        req.flush({});
    });

    it('should attach token to auth logout endpoint', () => {
        tokenService.getAccessToken.and.returnValue('test-token');

        httpClient.post('/api/auth/logout', {}).subscribe();

        const req = httpMock.expectOne('/api/auth/logout');
        expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
        req.flush({});
    });

    it('should not attach token to entra-login endpoint', () => {
        tokenService.getAccessToken.and.returnValue('test-token');

        httpClient.post('/api/auth/entra-login', {}).subscribe();

        const req = httpMock.expectOne('/api/auth/entra-login');
        expect(req.request.headers.has('Authorization')).toBeFalse();
        req.flush({});
    });

    it('should call refresh once when a 401 is received and retry with new token', fakeAsync(() => {
        tokenService.getAccessToken.and.returnValue('expired-token');

        authService.refreshToken.and.returnValue(
            new Observable((subscriber: any) => {
                subscriber.next({ accessToken: 'new-token' });
                subscriber.complete();
            }),
        );

        let result: any;
        httpClient.get('/api/users').subscribe((r) => (result = r));

        // First request fails with 401
        const req1 = httpMock.expectOne('/api/users');
        req1.flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
        tick();

        // Retry with new token
        const req2 = httpMock.expectOne('/api/users');
        expect(req2.request.headers.get('Authorization')).toBe('Bearer new-token');
        req2.flush({ data: 'success' });
        tick();

        expect(result).toEqual({ data: 'success' });
        expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    }));

    it('should call handleAuthFailure when refresh fails', fakeAsync(() => {
        tokenService.getAccessToken.and.returnValue('expired-token');

        authService.refreshToken.and.returnValue(
            throwError(() => new Error('Refresh failed')),
        );

        let error: any;
        httpClient.get('/api/users').subscribe({
            error: (e) => (error = e),
        });

        const req1 = httpMock.expectOne('/api/users');
        req1.flush({}, { status: 401, statusText: 'Unauthorized' });
        tick();

        expect(authService.handleAuthFailure).toHaveBeenCalledTimes(1);
        expect(error).toBeTruthy();
    }));

    it('should queue pending requests during refresh and retry all with new token', fakeAsync(() => {
        tokenService.getAccessToken.and.returnValue('expired-token');

        const refreshSubject = new Subject<{ accessToken: string }>();
        authService.refreshToken.and.returnValue(refreshSubject.asObservable());

        let result1: any;
        let result2: any;
        httpClient.get('/api/users').subscribe((r) => (result1 = r));
        httpClient.get('/api/roles').subscribe((r) => (result2 = r));

        // Both requests fail with 401
        const req1 = httpMock.expectOne('/api/users');
        req1.flush({}, { status: 401, statusText: 'Unauthorized' });
        tick();

        const req2 = httpMock.expectOne('/api/roles');
        req2.flush({}, { status: 401, statusText: 'Unauthorized' });
        tick();

        // Refresh completes
        refreshSubject.next({ accessToken: 'new-token' });
        refreshSubject.complete();
        tick();

        // Both retried with new token
        const retryReqs = httpMock.match(() => true);
        expect(retryReqs.length).toBe(2);
        for (const retryReq of retryReqs) {
            expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-token');
        }
        // Flush each by URL
        const usersRetry = retryReqs.find((r) => r.request.url === '/api/users')!;
        const rolesRetry = retryReqs.find((r) => r.request.url === '/api/roles')!;
        usersRetry.flush({ data: 'users' });
        rolesRetry.flush({ data: 'roles' });
        tick();

        expect(result1).toEqual({ data: 'users' });
        expect(result2).toEqual({ data: 'roles' });
        expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    }));

    it('should not create infinite retry loops', fakeAsync(() => {
        tokenService.getAccessToken.and.returnValue('expired-token');

        authService.refreshToken.and.returnValue(
            throwError(() => ({ status: 401 })),
        );

        let errorCaught = false;
        httpClient.get('/api/users').subscribe({
            error: () => (errorCaught = true),
        });

        const req = httpMock.expectOne('/api/users');
        req.flush({}, { status: 401, statusText: 'Unauthorized' });
        tick();

        expect(errorCaught).toBeTrue();
        expect(authService.refreshToken).toHaveBeenCalledTimes(1);
        expect(authService.handleAuthFailure).toHaveBeenCalledTimes(1);
    }));
});
