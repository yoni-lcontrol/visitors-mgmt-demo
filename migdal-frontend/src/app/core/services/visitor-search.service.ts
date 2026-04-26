import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiService } from '@core/api/api.service';

export interface VisitorSuggestion {
    id: string;
    firstName: string;
    lastName: string;
    personId: string;
    phone: string | null;
    email: string | null;
    carNumber: string | null;
    vehicleType: string | null;
}

@Injectable({ providedIn: 'root' })
export class VisitorSearchService {
    private api = inject(ApiService);

    searchByPersonId(prefix: string): Observable<VisitorSuggestion[]> {
        if (!prefix || prefix.trim().length < 4) {
            return of([]);
        }
        return this.api.get<VisitorSuggestion[]>('/visitors/search', { personId: prefix.trim() });
    }
}
