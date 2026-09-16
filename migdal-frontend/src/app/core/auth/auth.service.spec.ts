import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { UserWebSocketService } from '../websocket/user-websocket.service';
import { WorkstationSessionService } from '../services/workstation-session.service';
import { DeviceStatusService } from '../services/device-status.service';
import { ScannerEventService } from '../services/scanner-event.service';

describe('AuthService', () => {
    let service: AuthService;
    let httpMock: HttpTestingController;
    let tokenService: jasmine.SpyObj<TokenService>;
    let router: jasmine.SpyObj<Router>;
    let userWsService: jasmine.SpyObj<UserWebSocketService>;
    let wsSession: jasmine.SpyObj<WorkstationSessionService>;
    let deviceStatus: jasmine.SpyObj<DeviceStatusService>;
    let scannerEvent: jasmine.SpyObj<ScannerEventService>;

    beforeEach(() => {
        tokenService = jasmine.createSpyObj('TokenService', [
            'getAccessToken',
            'setAccessToken',
            'clearAccessToken',
            'hasToken',
        ]);
        router = jasmine.createSpyObj('Router', ['navigate']);
        userWsService = jasmine.createSpyObj('UserWebSocketService', ['connect', 'disconnect']);
        wsSession = jasmine.createSpyObj('WorkstationSessionService', ['reset']);
        deviceStatus = jasmine.createSpyObj('DeviceStatusService', ['reset']);
        scannerEvent = jasmine.createSpyObj('ScannerEventService', ['reset']);

        TestBed.configureTestingModule({
            providers: [
                AuthService,
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: TokenService, useValue: tokenService },
                { provide: Router, useValue: router },
                { provide: UserWebSocketService, useValue: userWsService },
                { provide: WorkstationSessionService, useValue: wsSession },
                { provide: DeviceStatusService, useValue: deviceStatus },
                { provide: ScannerEventService, useValue: scannerEvent },
            ],
        });

        service = TestBed.inject(AuthService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    describe('login', () => {
        it('should set token and user on successful login', fakeAsync(() => {
            const mockResponse = {
                accessToken: 'test-access-token',
                user: {
                    id: 'u1',
                    username: 'admin',
                    firstName: 'Admin',
                    lastName: 'User',
                    roles: ['Admin'],
                    permissions: ['users.read', 'users.create'],
                },
            };

            let result: any;
            service.login({ username: 'admin', password: 'pass' }).subscribe((r) => (result = r));

            const req = httpMock.expectOne((r) => r.url.includes('/auth/login'));
            expect(req.request.method).toBe('POST');
            expect(req.request.withCredentials).toBeTrue();
            req.flush(mockResponse);
            tick();

            expect(tokenService.setAccessToken).toHaveBeenCalledWith('test-access-token');
            expect(service.currentUser?.username).toBe('admin');
            expect(service.isAuthenticated).toBeTrue();
            expect(userWsService.connect).toHaveBeenCalled();
        }));
    });

    describe('tryRestoreSession', () => {
        it('should restore session on app startup via refresh cookie', fakeAsync(() => {
            const mockUser = {
                id: 'u1',
                username: 'admin',
                firstName: 'Admin',
                lastName: 'User',
                roles: ['Admin'],
                permissions: ['users.read'],
            };

            let restored = false;
            service.tryRestoreSession().subscribe((r) => (restored = r));

            const req = httpMock.expectOne((r) => r.url.includes('/auth/refresh'));
            expect(req.request.method).toBe('POST');
            expect(req.request.withCredentials).toBeTrue();
            req.flush({ accessToken: 'new-token', user: mockUser });
            tick();

            expect(restored).toBeTrue();
            expect(tokenService.setAccessToken).toHaveBeenCalledWith('new-token');
            expect(service.currentUser?.username).toBe('admin');
            expect(service.isAuthenticated).toBeTrue();
        }));

        it('should return false when refresh cookie is invalid', fakeAsync(() => {
            let restored: boolean | undefined;
            service.tryRestoreSession().subscribe((r) => (restored = r));

            const req = httpMock.expectOne((r) => r.url.includes('/auth/refresh'));
            req.flush({}, { status: 401, statusText: 'Unauthorized' });
            tick();

            expect(restored).toBeFalse();
            expect(service.isAuthenticated).toBeFalse();
        }));

        it('should fetch /me when refresh returns no user data', fakeAsync(() => {
            const mockUser = {
                id: 'u1',
                username: 'admin',
                firstName: 'Admin',
                lastName: 'User',
                roles: ['Admin'],
                permissions: ['users.read'],
            };

            let restored = false;
            service.tryRestoreSession().subscribe((r) => (restored = r));

            const refreshReq = httpMock.expectOne((r) => r.url.includes('/auth/refresh'));
            refreshReq.flush({ accessToken: 'new-token' });
            tick();

            const meReq = httpMock.expectOne((r) => r.url.includes('/auth/me'));
            meReq.flush(mockUser);
            tick();

            expect(restored).toBeTrue();
            expect(service.currentUser?.username).toBe('admin');
        }));
    });

    describe('refreshToken', () => {
        it('should update access token and user state after refresh', fakeAsync(() => {
            const mockUser = {
                id: 'u1',
                username: 'admin',
                firstName: 'Admin',
                lastName: 'User',
                roles: ['Admin'],
                permissions: ['users.read', 'users.create'],
            };

            let result: any;
            service.refreshToken().subscribe((r) => (result = r));

            const req = httpMock.expectOne((r) => r.url.includes('/auth/refresh'));
            expect(req.request.withCredentials).toBeTrue();
            req.flush({ accessToken: 'refreshed-token', user: mockUser });
            tick();

            expect(tokenService.setAccessToken).toHaveBeenCalledWith('refreshed-token');
            expect(service.currentUser?.permissions).toContain('users.create');
        }));
    });

    describe('logout', () => {
        it('should clear auth state on logout', fakeAsync(() => {
            // First login to set state
            service.login({ username: 'admin', password: 'pass' }).subscribe();
            const loginReq = httpMock.expectOne((r) => r.url.includes('/auth/login'));
            loginReq.flush({
                accessToken: 'tok',
                user: { id: 'u1', username: 'admin', firstName: 'A', lastName: 'U', roles: [], permissions: [] },
            });
            tick();

            expect(service.isAuthenticated).toBeTrue();

            service.logout();

            const logoutReq = httpMock.expectOne((r) => r.url.includes('/auth/logout'));
            logoutReq.flush({});
            tick();

            expect(tokenService.clearAccessToken).toHaveBeenCalled();
            expect(service.currentUser).toBeNull();
            expect(service.isAuthenticated).toBeFalse();
            expect(userWsService.disconnect).toHaveBeenCalled();
            expect(wsSession.reset).toHaveBeenCalled();
            expect(deviceStatus.reset).toHaveBeenCalled();
            expect(scannerEvent.reset).toHaveBeenCalled();
            expect(router.navigate).toHaveBeenCalledWith(['/login']);
        }));
    });

    describe('kerberos manual-login flag', () => {
        afterEach(() => {
            sessionStorage.clear();
        });

        it('should disable auto-kerberos on logout and re-enable it on enableAutoKerberos', fakeAsync(() => {
            expect(service.isAutoKerberosDisabled()).toBeFalse();

            service.logout();
            const logoutReq = httpMock.expectOne((r) => r.url.includes('/auth/logout'));
            logoutReq.flush({});
            tick();

            expect(service.isAutoKerberosDisabled()).toBeTrue();

            service.enableAutoKerberos();

            expect(service.isAutoKerberosDisabled()).toBeFalse();
        }));
    });

    describe('handleAuthFailure', () => {
        it('should clear state and redirect to login', () => {
            service.handleAuthFailure();

            expect(tokenService.clearAccessToken).toHaveBeenCalled();
            expect(service.currentUser).toBeNull();
            expect(service.isAuthenticated).toBeFalse();
            expect(wsSession.reset).toHaveBeenCalled();
            expect(deviceStatus.reset).toHaveBeenCalled();
            expect(scannerEvent.reset).toHaveBeenCalled();
            expect(router.navigate).toHaveBeenCalledWith(['/login']);
        });
    });
});
