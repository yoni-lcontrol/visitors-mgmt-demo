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
  private readonly printerUrl = `${this.kioskCfg.config.API_PRINTER_URL}`;

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

  checkIn(params: { visitorId: number | string; visitId: number | undefined; siteId: number | undefined; personId?: string; file: File; }): Observable<any> {
    const form = new FormData();
    form.append('file', params.file, params.file.name);
    form.append('visitorId', String(params.visitorId ?? ''));
    form.append('visitId', String(params.visitId ?? ''));
    form.append('siteId', String(params.siteId ?? ''));
    if (params.personId)
      form.append('personId', params.personId);

    return this.http.post(`${this.baseUrl}/api/visits/kiosk/check-in`, form);
  }

  fetchCardTemplates(): Observable<CardTemplate[]> {
    return this.http.get<CardTemplate[]>(`${this.baseUrl}/api/visits/kiosk/card-templates`);
  }

  printVisitorCard(printVisitorCard: PrintVisitorCard): Observable<unknown> {
    return this.http.post(`${this.printerUrl}/api/print/card-from-template`, printVisitorCard);
  }


}
