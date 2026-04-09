import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { User, Role, PaginatedResult } from '../../../core/models/entities.model';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
    private readonly api = inject(ApiService);
    private readonly basePath = '/users';

    getAll(params: Record<string, string | number>): Observable<PaginatedResult<User>> {
        return this.api.get<PaginatedResult<User>>(this.basePath, params);
    }

    getById(id: string): Observable<User> {
        return this.api.get<User>(`${this.basePath}/${id}`);
    }

    create(payload: Record<string, unknown>): Observable<User> {
        return this.api.post<User>(this.basePath, payload);
    }

    update(id: string, payload: Record<string, unknown>): Observable<User> {
        return this.api.patch<User>(`${this.basePath}/${id}`, payload);
    }

    delete(id: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/${id}`);
    }

    export(params: Record<string, string | number>): Observable<Blob> {
        return this.api.download(`${this.basePath}/export`, params);
    }

    syncAd(): Observable<{ configsProcessed: number; configsFailed: number; totalCreated: number; totalUpdated: number; totalDeactivated: number; totalSkipped: number }> {
        return this.api.post(`${this.basePath}/sync-ad`, {});
    }

    getRoles(params?: Record<string, string | number>): Observable<PaginatedResult<Role>> {
        return this.api.get<PaginatedResult<Role>>('/roles', params ?? { limit: 100 });
    }
}
