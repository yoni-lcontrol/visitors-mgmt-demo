import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/api/api.service';
import { PaginatedResult } from '@core/models/entities.model';

export interface VehicleModel {
    id: string;
    manufacturer: string;
    model: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    updatedBy: string | null;
}

export interface VehicleModelPayload {
    manufacturer: string;
    model: string;
}

@Injectable({ providedIn: 'root' })
export class VehicleModelsApiService {
    private readonly api = inject(ApiService);
    private readonly basePath = '/settings/vehicle-models';

    getAll(params: Record<string, string | number>): Observable<PaginatedResult<VehicleModel>> {
        return this.api.get<PaginatedResult<VehicleModel>>(this.basePath, params);
    }

    getById(id: string): Observable<VehicleModel> {
        return this.api.get<VehicleModel>(`${this.basePath}/${id}`);
    }

    create(payload: VehicleModelPayload): Observable<VehicleModel> {
        return this.api.post<VehicleModel>(this.basePath, payload);
    }

    update(id: string, payload: Partial<VehicleModelPayload>): Observable<VehicleModel> {
        return this.api.patch<VehicleModel>(`${this.basePath}/${id}`, payload);
    }

    delete(id: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/${id}`);
    }

    getManufacturers(): Observable<string[]> {
        return this.api.get<string[]>(`${this.basePath}/manufacturers`);
    }

    export(params: Record<string, string | number>): Observable<Blob> {
        return this.api.download(`${this.basePath}/export`, params);
    }
}
