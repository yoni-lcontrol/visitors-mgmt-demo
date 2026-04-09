import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenService {
    private accessToken: string | null = null;

    getAccessToken(): string | null {
        return this.accessToken;
    }

    setAccessToken(token: string): void {
        this.accessToken = token;
    }

    clearAccessToken(): void {
        this.accessToken = null;
    }

    hasToken(): boolean {
        return !!this.accessToken;
    }
}
