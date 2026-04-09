import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import {
    CardTemplate,
    CreateCardTemplateRequest,
    UpdateCardTemplateRequest,
} from '../card-templates/models/card-template.model';

@Injectable({ providedIn: 'root' })
export class CardTemplateApiService {
    private readonly api = inject(ApiService);
    private readonly basePath = '/settings/card-templates';

    getAll(): Observable<CardTemplate[]> {
        return this.api.get<CardTemplate[]>(this.basePath);
    }

    getById(id: string): Observable<CardTemplate> {
        return this.api.get<CardTemplate>(`${this.basePath}/${id}`);
    }

    create(data: CreateCardTemplateRequest): Observable<CardTemplate> {
        return this.api.post<CardTemplate>(this.basePath, data);
    }

    update(id: string, data: UpdateCardTemplateRequest): Observable<CardTemplate> {
        return this.api.patch<CardTemplate>(`${this.basePath}/${id}`, data);
    }

    delete(id: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/${id}`);
    }

    testPrint(id: string): Observable<{ correlationId: string; status: string }> {
        return this.api.post<{ correlationId: string; status: string }>(`${this.basePath}/${id}/test-print`, {});
    }
}
