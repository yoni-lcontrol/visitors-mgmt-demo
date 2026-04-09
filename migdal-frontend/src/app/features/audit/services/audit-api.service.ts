import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { PaginatedResult, AuditLog } from '../../../core/models/entities.model';

@Injectable({ providedIn: 'root' })
export class AuditApiService {
    private readonly basePath = '/audit';

    constructor(private api: ApiService) { }

    findAll(params: Record<string, string | number>): Observable<PaginatedResult<AuditLog>> {
        return this.api.get<PaginatedResult<AuditLog>>(this.basePath, params);
    }

    download(params: Record<string, string | number>): Observable<Blob> {
        return this.api.download(`${this.basePath}/export`, params);
    }
}
