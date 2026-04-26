import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/api/api.service';

export interface PermanentEscortDomain {
    id: string;
    name: string;
}

export interface PermanentEscortDomainUser {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PermanentEscortItem {
    id: string;
    userId: string;
    fullName: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    domain: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class PermanentEscortsApiService {
    private readonly api = inject(ApiService);
    private readonly basePath = '/settings/permanent-escorts';

    getAll(): Observable<PermanentEscortItem[]> {
        return this.api.get<PermanentEscortItem[]>(this.basePath);
    }

    getDomains(): Observable<PermanentEscortDomain[]> {
        return this.api.get<PermanentEscortDomain[]>(`${this.basePath}/domains`);
    }

    getUsersByDomain(domainId: string): Observable<PermanentEscortDomainUser[]> {
        return this.api.get<PermanentEscortDomainUser[]>(`${this.basePath}/domain-users/${domainId}`);
    }

    add(domainId: string, userId: string): Observable<PermanentEscortItem> {
        return this.api.post<PermanentEscortItem>(this.basePath, { domainId, userId });
    }

    remove(userId: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/${userId}`);
    }
}
