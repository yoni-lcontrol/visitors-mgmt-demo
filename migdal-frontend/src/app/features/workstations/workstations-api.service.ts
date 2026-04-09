import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
    WorkstationListItem,
    WorkstationDetail,
    CreateEnrollmentTokenResponse,
} from '../../core/models/entities.model';

@Injectable({ providedIn: 'root' })
export class WorkstationsApiService {
    private readonly api = inject(ApiService);
    private readonly basePath = '/workstations';

    getAll(): Observable<WorkstationListItem[]> {
        return this.api.get<WorkstationListItem[]>(this.basePath);
    }

    getById(id: string): Observable<WorkstationDetail> {
        return this.api.get<WorkstationDetail>(`${this.basePath}/${id}`);
    }

    create(data: { displayName: string; code?: string; description?: string; siteId?: string; defaultCardTemplateId?: string }): Observable<WorkstationListItem> {
        return this.api.post<WorkstationListItem>(this.basePath, data);
    }

    update(id: string, data: { displayName?: string; description?: string; siteId?: string; isActive?: boolean; defaultCardTemplateId?: string | null }): Observable<WorkstationListItem> {
        return this.api.patch<WorkstationListItem>(`${this.basePath}/${id}`, data);
    }

    delete(id: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/${id}`);
    }

    assignRoles(id: string, roleIds: string[]): Observable<void> {
        return this.api.post<void>(`${this.basePath}/${id}/assign-roles`, { roleIds });
    }

    getAvailableRoles(): Observable<{ id: string; name: string }[]> {
        return this.api.get<{ id: string; name: string }[]>(`${this.basePath}/available-roles`);
    }

    createEnrollmentToken(id: string, providerType: string): Observable<CreateEnrollmentTokenResponse> {
        return this.api.post<CreateEnrollmentTokenResponse>(`${this.basePath}/${id}/enrollment-token`, { providerType });
    }
}
