import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/api/api.service';
import { PaginatedResult, Visitor } from '@core/models/entities.model';

export interface VisitorPayload {
    personId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    carNumber?: string;
    vehicleType?: string;
}

@Injectable({ providedIn: 'root' })
export class VisitorsApiService {
    private readonly api = inject(ApiService);
    private readonly basePath = '/visitors';

    getAll(params: Record<string, string | number>): Observable<PaginatedResult<Visitor>> {
        return this.api.get<PaginatedResult<Visitor>>(this.basePath, params);
    }

    create(payload: VisitorPayload): Observable<Visitor> {
        return this.api.post<Visitor>(this.basePath, payload);
    }

    update(id: string, payload: Partial<VisitorPayload>): Observable<Visitor> {
        return this.api.patch<Visitor>(`${this.basePath}/${id}`, payload);
    }

    delete(id: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/${id}`);
    }

    export(params: Record<string, string | number>): Observable<Blob> {
        return this.api.download(`${this.basePath}/export`, params);
    }
}
