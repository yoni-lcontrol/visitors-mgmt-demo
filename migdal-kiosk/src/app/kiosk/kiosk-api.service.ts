import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { VisitResponse } from '../models/kiosk-api.models';
import { CardTemplate } from '../models/card-template.model';
import { PrintVisitorCard } from '../models/print-visitor-card';
import { KioskConfigService } from '../config/kiosk-config.service';

@Injectable({ providedIn: 'root' })
export class KioskApiService {

  private readonly baseUrl = `${this.kioskCfg.config.API_BASE_URL}`;

  constructor(
    private http: HttpClient,
    private kioskCfg: KioskConfigService
  ) { }

  private unwrap<T>(): (source: Observable<{ data: T }>) => Observable<T> {
    return (source) => source.pipe(map((res) => res.data));
  }

  validateVisitCode(visitCode: string): Observable<VisitResponse> {
    return this.http.post<{ data: VisitResponse }>(`${this.baseUrl}/api/visits/kiosk/validate-visitcode`, { visitCode })
      .pipe(this.unwrap());
  }

  validatePersonId(personId: string): Observable<VisitResponse> {
    return this.http.post<{ data: VisitResponse }>(`${this.baseUrl}/api/visits/kiosk/validate-person-id`, { personId })
      .pipe(this.unwrap());
  }

  arrive(params: { visitorId: number | string; visitId: number | undefined; siteId: number | undefined; personId?: string; workstationCode?: string; file: File; }): Observable<any> {
    const formData = new FormData();
    formData.append('visitId', String(params.visitId ?? ''));
    formData.append('visitorId', String(params.visitorId ?? ''));
    formData.append('siteId', String(params.siteId ?? ''));
    formData.append('personId', params.personId ?? '');
    if (params.workstationCode) {
      formData.append('workstationCode', params.workstationCode);
    }
    formData.append('file', params.file, params.file.name);

    return this.http.post<{ data: any }>(`${this.baseUrl}/api/visits/kiosk/arrive`, formData)
      .pipe(this.unwrap());
  }

  fetchCardTemplates(): Observable<CardTemplate[]> {
    return this.http.get<{ data: CardTemplate[] }>(`${this.baseUrl}/api/visits/kiosk/card-templates`)
      .pipe(this.unwrap());
  }

  printCard(params: { workstationCode: string; visitId: string; visitorId: string; cardTemplateId?: string; }): Observable<any> {
    return this.http.post<{ data: any }>(`${this.baseUrl}/api/visits/kiosk/print-card`, params)
      .pipe(this.unwrap());
  }

}
