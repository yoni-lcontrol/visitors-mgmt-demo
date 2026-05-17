import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '@core/api/api.service';

export interface BlacklistCheckResult {
    isBlacklisted: boolean;
    blacklistId?: string;
    reason?: string;
    blockedUntil?: string | null;
}

@Injectable({ providedIn: 'root' })
export class BlacklistCheckService {
    private api = inject(ApiService);

    check(idNumber: string): Observable<BlacklistCheckResult> {
        if (!idNumber || !idNumber.trim()) {
            return of({ isBlacklisted: false });
        }
        return this.api.get<BlacklistCheckResult>(`/visitors/blacklist/check/${encodeURIComponent(idNumber.trim())}`);
    }
}
