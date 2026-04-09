import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { Role, Permission, PaginatedResult } from '../../../core/models/entities.model';

@Injectable({ providedIn: 'root' })
export class RolesApiService {
    private readonly api = inject(ApiService);
    private readonly basePath = '/roles';

    getAll(params: Record<string, string | number>): Observable<PaginatedResult<Role>> {
        return this.api.get<PaginatedResult<Role>>(this.basePath, params);
    }

    getById(id: string): Observable<Role> {
        return this.api.get<Role>(`${this.basePath}/${id}`);
    }

    create(payload: Record<string, unknown>): Observable<Role> {
        return this.api.post<Role>(this.basePath, payload);
    }

    update(id: string, payload: Record<string, unknown>): Observable<Role> {
        return this.api.patch<Role>(`${this.basePath}/${id}`, payload);
    }

    delete(id: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/${id}`);
    }

    export(params: Record<string, string | number>): Observable<Blob> {
        return this.api.download(`${this.basePath}/export`, params);
    }

    getPermissionsGrouped(): Observable<Record<string, Permission[]>> {
        return this.api.get<Record<string, Permission[]>>('/permissions/grouped');
    }
}
