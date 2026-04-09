import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiService } from '@core/api/api.service';

export interface AdPersonSuggestion {
    firstName: string;
    lastName: string;
    displayName: string;
    email: string | null;
    phone: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdSearchService {
    private api = inject(ApiService);

    searchPeople(query: string): Observable<AdPersonSuggestion[]> {
        if (!query || query.trim().length < 2) {
            return of([]);
        }
        return this.api.get<AdPersonSuggestion[]>('/settings/ad-configurations/search-people', { query: query.trim() });
    }
}
