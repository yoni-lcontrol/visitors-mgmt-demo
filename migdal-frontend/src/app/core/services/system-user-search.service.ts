import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '@core/api/api.service';
import { PaginatedResult, User } from '@core/models/entities.model';

export interface SystemUserSuggestion {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    sectorName: string | null;
}

@Injectable({ providedIn: 'root' })
export class SystemUserSearchService {
    private api = inject(ApiService);

    searchUsers(query: string): Observable<SystemUserSuggestion[]> {
        if (!query || query.trim().length < 2) {
            return of([]);
        }

        return this.api.get<PaginatedResult<User>>('/users', {
            search: query.trim(),
            page: 1,
            limit: 10,
            sortBy: 'firstName',
            sortOrder: 'ASC',
            filters: JSON.stringify({ isActive: { value: true, matchMode: 'equals' } }),
        }).pipe(
            map((result) => result.items.map((user) => ({
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: `${user.firstName} ${user.lastName}`.trim(),
                email: user.email,
                phone: user.phone,
                sectorName: user.sector?.name ?? null,
            }))),
        );
    }
}
