import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface TokenResponse {
  deviceId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

type DeviceCreds = { deviceId: string; deviceSecret: string };

@Injectable({ providedIn: 'root' })
export class AuthService {

  // private accessToken$ = new BehaviorSubject<string | null>(null);

  // constructor(private http: HttpClient) {
  //   const access = sessionStorage.getItem(KIOSK_CONFIG.STORAGE_ACCESS_TOKEN);
  //   if (access) this.accessToken$.next(access);
  // }

  // getAccessToken(): string | null {
  //   return this.accessToken$.value;
  // }

  // saveDeviceCreds(creds: DeviceCreds) {
  //   localStorage.setItem(KIOSK_CONFIG.STORAGE_DEVICE_ID, creds.deviceId);
  //   localStorage.setItem(KIOSK_CONFIG.STORAGE_DEVICE_SECRET, creds.deviceSecret);
  // }

  // getDeviceCreds(): DeviceCreds | null {
  //   const deviceId = localStorage.getItem(KIOSK_CONFIG.STORAGE_DEVICE_ID);
  //   const deviceSecret = localStorage.getItem(KIOSK_CONFIG.STORAGE_DEVICE_SECRET);
  //   if (!deviceId || !deviceSecret) return null;
  //   return { deviceId, deviceSecret };
  // }

  // loginDevice(): Observable<TokenResponse> {
  //   const creds = this.getDeviceCreds();
  //   if (!creds) throw new Error('Missing kiosk device credentials');

  //   return this.http
  //     .post<TokenResponse>(this.url(KIOSK_CONFIG.AUTH_TOKEN_URL), creds)
  //     .pipe(tap((res) => this.persistTokens(res)));
  // }

  // refreshTokens(): Observable<TokenResponse> {
  //   const deviceId = localStorage.getItem(KIOSK_CONFIG.STORAGE_DEVICE_ID);
  //   const refreshToken = localStorage.getItem(KIOSK_CONFIG.STORAGE_REFRESH_TOKEN);

  //   if (!deviceId || !refreshToken) throw new Error('Missing refresh token');

  //   return this.http
  //     .post<TokenResponse>(this.url(KIOSK_CONFIG.AUTH_REFRESH_URL), { deviceId, refreshToken })
  //     .pipe(tap((res) => this.persistTokens(res)));
  // }

  // logoutDevice() {
  //   sessionStorage.removeItem(KIOSK_CONFIG.STORAGE_ACCESS_TOKEN);
  //   localStorage.removeItem(KIOSK_CONFIG.STORAGE_REFRESH_TOKEN);
  //   this.accessToken$.next(null);
  // }

  // private persistTokens(res: TokenResponse) {
  //   sessionStorage.setItem(KIOSK_CONFIG.STORAGE_ACCESS_TOKEN, res.accessToken);
  //   localStorage.setItem(KIOSK_CONFIG.STORAGE_REFRESH_TOKEN, res.refreshToken);
  //   this.accessToken$.next(res.accessToken);
  // }

  // private url(path: string) {
  //   return `${KIOSK_CONFIG.API_BASE_URL}${path}`;
  // }
}
