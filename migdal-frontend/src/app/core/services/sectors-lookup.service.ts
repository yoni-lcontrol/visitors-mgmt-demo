import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '@core/api/api.service';

export interface SectorLookupItem {
    id: string;
    name: string;
}

@Injectable({ providedIn: 'root' })
export class SectorsLookupService {
    private api = inject(ApiService);

    getActiveSectors(): Observable<SectorLookupItem[]> {
        return this.api.get<SectorLookupItem[]>('/sectors').pipe(
            map((items) => [...items].sort((a, b) => a.name.localeCompare(b.name))),
        );
    }
}
