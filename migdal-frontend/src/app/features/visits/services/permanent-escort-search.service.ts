import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '@core/api/api.service';

export interface PermanentEscortSuggestion {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    domainName: string | null;
}

interface PermanentEscortApiItem {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    phone?: string | null;
    domain: { id: string; name: string } | null;
}

@Injectable({ providedIn: 'root' })
export class PermanentEscortSearchService {
    private api = inject(ApiService);

    getAll(): Observable<PermanentEscortSuggestion[]> {
        return this.api.get<PermanentEscortApiItem[]>('/settings/permanent-escorts').pipe(
            map((items) =>
                items.map((item) => ({
                    id: item.id,
                    userId: item.userId,
                    firstName: item.firstName,
                    lastName: item.lastName,
                    fullName: item.fullName,
                    email: item.email,
                    phone: item.phone ?? null,
                    domainName: item.domain?.name ?? null,
                })),
            ),
        );
    }
}
