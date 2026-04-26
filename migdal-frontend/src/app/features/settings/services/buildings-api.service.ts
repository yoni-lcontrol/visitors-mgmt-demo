import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/api/api.service';
import { AccessLevel, PaginatedResult } from '@core/models/entities.model';

export interface Building {
    id: string;
    name: string;
    address: string | null;
    active: boolean;
    accessLevels: AccessLevel[];
    createdAt: string;
    updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class BuildingsApiService {
    private api = inject(ApiService);
    private readonly basePath = '/buildings';

    getAll(params?: Record<string, any>): Observable<PaginatedResult<Building>> {
        return this.api.get<PaginatedResult<Building>>(this.basePath, params);
    }

    create(dto: { name: string; address?: string; active?: boolean; accessLevelIds?: string[] }): Observable<Building> {
        return this.api.post<Building>(this.basePath, dto);
    }

    update(id: string, dto: Partial<{ name: string; address: string; active: boolean; accessLevelIds: string[] }>): Observable<Building> {
        return this.api.patch<Building>(`${this.basePath}/${id}`, dto);
    }

    getAccessLevels(params?: Record<string, any>): Observable<AccessLevel[]> {
        return this.api.get<AccessLevel[]>(`${this.basePath}/access-levels`, params);
    }
}
