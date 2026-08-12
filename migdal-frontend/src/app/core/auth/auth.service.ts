import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, map, catchError, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';
import { AuthUser, LoginRequest, LoginResponse, KerberosClientConfig } from './auth.models';
import { UserWebSocketService } from '../websocket/user-websocket.service';
import { WorkstationSessionService } from '../services/workstation-session.service';
import { DeviceStatusService } from '../services/device-status.service';
import { ScannerEventService } from '../services/scanner-event.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly apiUrl = `${environment.apiUrl}/auth`;

    private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
    currentUser$ = this.currentUserSubject.asObservable();

    private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

    constructor(
        private http: HttpClient,
        private tokenService: TokenService,
        private router: Router,
        private userWsService: UserWebSocketService,
        private wsSession: WorkstationSessionService,
        private deviceStatus: DeviceStatusService,
        private scannerEvent: ScannerEventService,
    ) { }

    get currentUser(): AuthUser | null {
        return this.currentUserSubject.value;
    }

    get isAuthenticated(): boolean {
        return this.isAuthenticatedSubject.value;
    }

    login(credentials: LoginRequest): Observable<LoginResponse> {
        return this.http
            .post<LoginResponse>(`${this.apiUrl}/login`, credentials, {
                withCredentials: true,
            })
            .pipe(
                tap((response) => {
                    this.tokenService.setAccessToken(response.accessToken);
                    this.setAuthenticatedUser(response.user);
                }),
            );
    }

    logout(): void {
        this.http
            .post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
            .subscribe({
                complete: () => this.clearAuthState(),
                error: () => this.clearAuthState(),
            });
    }

    /** Called by the interceptor when refresh fails — clears state and redirects once. */
    handleAuthFailure(): void {
        this.clearAuthState();
    }

    refreshToken(): Observable<{ accessToken: string; user?: AuthUser }> {
        return this.http
            .post<{ accessToken: string; user?: AuthUser }>(
                `${this.apiUrl}/refresh`,
                {},
                { withCredentials: true },
            )
            .pipe(
                tap((response) => {
                    this.tokenService.setAccessToken(response.accessToken);
                    if (response.user) {
                        this.setAuthenticatedUser(response.user);
                    }
                }),
            );
    }

    fetchCurrentUser(): Observable<AuthUser> {
        return this.http.get<AuthUser>(`${this.apiUrl}/me`).pipe(
            tap((user) => {
                this.setAuthenticatedUser(user);
            }),
        );
    }

    /**
     * On app startup / page reload, attempt to restore the session.
     * Since the access token is in-memory only, it's gone after reload.
     * We attempt a refresh (using the HttpOnly cookie) to get a new access token,
     * then fetch the current user to populate auth state.
     */
    tryRestoreSession(): Observable<boolean> {
        return this.http
            .post<{ accessToken: string; user?: AuthUser }>(
                `${this.apiUrl}/refresh`,
                {},
                { withCredentials: true },
            )
            .pipe(
                switchMap((response) => {
                    this.tokenService.setAccessToken(response.accessToken);
                    if (response.user) {
                        this.setAuthenticatedUser(response.user);
                        return of(true);
                    }
                    return this.fetchCurrentUser().pipe(map(() => true));
                }),
                catchError(() => of(false)),
            );
    }

    private setAuthenticatedUser(user: AuthUser): void {
        this.currentUserSubject.next(user);
        this.isAuthenticatedSubject.next(true);
        this.userWsService.connect();
    }

    private clearAuthState(): void {
        this.userWsService.disconnect();
        this.tokenService.clearAccessToken();
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        this.wsSession.reset();
        this.deviceStatus.reset();
        this.scannerEvent.reset();

        this.router.navigate(['/login']);
    }

    getKerberosConfig(): Observable<KerberosClientConfig> {
        return this.http.get<KerberosClientConfig>(`${this.apiUrl}/kerberos-config`);
    }

    loginWithKerberos(): Observable<LoginResponse> {
        return this.http
            .get<LoginResponse>(`${this.apiUrl}/kerberos-login`, {
                withCredentials: true,
            })
            .pipe(
                tap((response) => {
                    this.tokenService.setAccessToken(response.accessToken);
                    this.setAuthenticatedUser(response.user);
                }),
            );
    }
}
