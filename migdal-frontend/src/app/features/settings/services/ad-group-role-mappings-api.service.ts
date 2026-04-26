import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/api/api.service';

export interface AdGroupRoleMapping {
    id: number;
    groupName: string;
    roleId: string;
    role?: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdGroupRoleMappingsApiService {
    private readonly api = inject(ApiService);
    private readonly basePath = '/ad-group-role-mappings';

    getAll(): Observable<AdGroupRoleMapping[]> {
        return this.api.get<AdGroupRoleMapping[]>(this.basePath);
    }

    create(dto: { groupName: string; roleId: string }): Observable<AdGroupRoleMapping> {
        return this.api.post<AdGroupRoleMapping>(this.basePath, dto);
    }

    update(id: number, dto: Partial<{ groupName: string; roleId: string }>): Observable<AdGroupRoleMapping> {
        return this.api.patch<AdGroupRoleMapping>(`${this.basePath}/${id}`, dto);
    }

    delete(id: number): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/${id}`);
    }
}
