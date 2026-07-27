import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, map, catchError, from, switchMap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser';
import { MsalService } from '@azure/msal-angular';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';
import { AuthUser, LoginRequest, LoginResponse, EntraLoginRequest, EntraClientConfig, KerberosClientConfig } from './auth.models';
import { UserWebSocketService } from '../websocket/user-websocket.service';
import { WorkstationSessionService } from '../services/workstation-session.service';
import { DeviceStatusService } from '../services/device-status.service';
import { ScannerEventService } from '../services/scanner-event.service';
import { getBackendApiScopes, isEntraConfigured } from './msal.config';

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
        private msalService: MsalService,
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
        const activeAccount = this.msalService.instance.getActiveAccount();

        this.http
            .post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
            .subscribe({
                complete: () => this.clearAuthState(activeAccount),
                error: () => this.clearAuthState(activeAccount),
            });
    }

    /** Called by the interceptor when refresh fails — clears state and redirects once. */
    handleAuthFailure(): void {
        this.clearAuthState(this.msalService.instance.getActiveAccount());
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

    private clearAuthState(activeEntraAccount?: AccountInfo | null): void {
        this.userWsService.disconnect();
        this.tokenService.clearAccessToken();
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        this.wsSession.reset();
        this.deviceStatus.reset();
        this.scannerEvent.reset();

        if (activeEntraAccount) {
            this.msalService.instance.setActiveAccount(null);
            // Keep local logout non-blocking and best-effort.
            void this.msalService.instance.logoutPopup({
                account: activeEntraAccount,
                postLogoutRedirectUri:
                    environment.entra.postLogoutRedirectUri || environment.entra.redirectUri,
            }).catch(() => undefined);
        }

        this.router.navigate(['/login']);
    }

    get isEntraEnabled(): boolean {
        return isEntraConfigured();
    }

    getEntraConfig(): Observable<EntraClientConfig> {
        return this.http.get<EntraClientConfig>(`${this.apiUrl}/entra-config`);
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

    loginWithEntra(): Observable<LoginResponse> {
        const scopes = getBackendApiScopes();

        return from(this.msalService.instance.initialize()).pipe(
            switchMap(() =>
                this.msalService.loginPopup({
                    scopes,
                    prompt: 'select_account',
                }),
            ),
            switchMap((result) => {
                this.msalService.instance.setActiveAccount(result.account);

                const account = result.account;
                if (!account) {
                    throw new Error('No Microsoft account returned from login flow');
                }

                return this.acquireApiToken(account, scopes).pipe(
                    switchMap((accessToken) => {
                        const body: EntraLoginRequest = { accessToken };
                        return this.http.post<LoginResponse>(
                            `${this.apiUrl}/entra-login`,
                            body,
                            { withCredentials: true },
                        );
                    }),
                );
            }),
            tap((response) => {
                this.tokenService.setAccessToken(response.accessToken);
                this.setAuthenticatedUser(response.user);
            }),
        );
    }

    private acquireApiToken(account: AccountInfo, scopes: string[]): Observable<string> {
        return this.msalService.acquireTokenSilent({
            account,
            scopes,
        }).pipe(
            map((result) => result.accessToken),
            catchError((error: unknown) => {
                if (error instanceof InteractionRequiredAuthError) {
                    return this.msalService.acquireTokenPopup({ account, scopes }).pipe(
                        map((result) => result.accessToken),
                    );
                }

                return throwError(() => error);
            }),
        );
    }
}
