import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/api/api.service';
import { PaginatedResult } from '@core/models/paginated-result.model';
import { Visit, VisitVisitor, VisitEscort } from '@core/models/entities.model';

export interface CheckInCode {
    id: string;
    visitVisitorId: string;
    visitId: string;
    visitorId: string;
    code: string;
    validFromUtc: string;
    validToUtc: string;
    usedAtUtc: string | null;
    isActive: boolean;
    sentBySms: boolean;
    sentByEmail: boolean;
    lastSentAtUtc: string | null;
    createdAt: string;
}

export interface OnSiteVisitor {
    visitId: string;
    visitVisitorId: string;
    visitorId: string;
    visitorFirstName: string;
    visitorLastName: string;
    visitorFullName: string;
    visitorPhone: string | null;
    visitorEmail: string | null;
    visitorPersonId: string;
    visitorCarNumber: string | null;
    visitTitle: string;
    plannedStartTimeUtc: string;
    plannedEndTimeUtc: string | null;
    siteId: string | null;
    purposeOfVisit: string | null;
    currentStatus: number;
    arrivedAtUtc: string | null;
    checkedInAtUtc: string | null;
    checkedOutAtUtc: string | null;
    lastEventTimeUtc: string | null;
    isBlacklisted: boolean;
    blacklistReason: string | null;
    visitRequesterFirstName: string | null;
    visitRequesterLastName: string | null;
    visitRequesterPhone: string | null;
    visitRequesterEmail: string | null;
}

export interface OnSiteResponse {
    items: OnSiteVisitor[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    summary: {
        onSite: number;
        arrived: number;
        checkedIn: number;
        blacklisted: number;
    };
}

export interface OnSiteQuery {
    date?: string;
    siteId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
}

export interface EntranceExitLog {
    visitVisitorId: string;
    visitorId: string;
    firstName: string;
    lastName: string;
    personId: string;
    phone: string | null;
    email: string | null;
    currentStatus: number;
    arrivedAtUtc: string | null;
    checkedInAtUtc: string | null;
    checkedOutAtUtc: string | null;
    lastEventTimeUtc: string | null;
}

export interface EntranceExitLogQuery {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    personId?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
}

export interface EntranceExitLogResponse {
    items: EntranceExitLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface TodaySummary {
    totalVisitsToday: number;
    arrivedToday: number;
    checkedInToday: number;
    completedToday: number;
}

@Injectable({ providedIn: 'root' })
export class VisitsApiService {
    private api = inject(ApiService);

    getTodaySummary(): Observable<TodaySummary> {
        return this.api.get<TodaySummary>('/visits/today-summary');
    }

    getOnSiteVisitors(query: OnSiteQuery = {}): Observable<OnSiteResponse> {
        const params: Record<string, string | number> = {};
        if (query.date) params['date'] = query.date;
        if (query.siteId) params['siteId'] = query.siteId;
        if (query.status) params['status'] = query.status;
        if (query.search) params['search'] = query.search;
        if (query.page) params['page'] = query.page;
        if (query.limit) params['limit'] = query.limit;
        if (query.sortBy) params['sortBy'] = query.sortBy;
        if (query.sortOrder) params['sortOrder'] = query.sortOrder;
        return this.api.get<OnSiteResponse>('/visits/on-site', params);
    }

    getCheckInCodes(visitId: string): Observable<CheckInCode[]> {
        return this.api.get<CheckInCode[]>(`/visits/${visitId}/check-in-codes`);
    }

    resendCheckInCode(visitVisitorId: string): Observable<{ sent: boolean }> {
        return this.api.post<{ sent: boolean }>(`/visits/visit-visitors/${visitVisitorId}/check-in-codes/resend`, {});
    }

    regenerateCheckInCode(visitVisitorId: string): Observable<CheckInCode> {
        return this.api.post<CheckInCode>(`/visits/visit-visitors/${visitVisitorId}/check-in-codes/regenerate`, {});
    }

    getEntranceExitLogs(query: EntranceExitLogQuery = {}): Observable<EntranceExitLogResponse> {
        const params: Record<string, string | number> = {};
        if (query.dateFrom) params['dateFrom'] = query.dateFrom;
        if (query.dateTo) params['dateTo'] = query.dateTo;
        if (query.status) params['status'] = query.status;
        if (query.personId) params['personId'] = query.personId;
        if (query.firstName) params['firstName'] = query.firstName;
        if (query.lastName) params['lastName'] = query.lastName;
        if (query.phone) params['phone'] = query.phone;
        if (query.email) params['email'] = query.email;
        if (query.search) params['search'] = query.search;
        if (query.page) params['page'] = query.page;
        if (query.limit) params['limit'] = query.limit;
        if (query.sortBy) params['sortBy'] = query.sortBy;
        if (query.sortOrder) params['sortOrder'] = query.sortOrder;
        return this.api.get<EntranceExitLogResponse>('/visitors/logs/entrance-exit', params);
    }

    downloadEntranceExitLogs(query: EntranceExitLogQuery = {}): Observable<Blob> {
        const params: Record<string, string | number> = {};
        if (query.dateFrom) params['dateFrom'] = query.dateFrom;
        if (query.dateTo) params['dateTo'] = query.dateTo;
        if (query.status) params['status'] = query.status;
        if (query.personId) params['personId'] = query.personId;
        if (query.firstName) params['firstName'] = query.firstName;
        if (query.lastName) params['lastName'] = query.lastName;
        if (query.phone) params['phone'] = query.phone;
        if (query.email) params['email'] = query.email;
        if (query.search) params['search'] = query.search;
        return this.api.download('/visitors/logs/entrance-exit/export', params);
    }

    getUpcomingVisits(limit: number = 5): Observable<PaginatedResult<Visit>> {
        return this.api.get<PaginatedResult<Visit>>('/visits', {
            timeFilter: 'today',
            limit,
            page: 1,
            sortBy: 'plannedStartTimeUtc',
            sortOrder: 'ASC',
        });
    }

    // ── Visit CRUD ──

    getVisits(params: Record<string, string | number> = {}): Observable<PaginatedResult<Visit>> {
        return this.api.get<PaginatedResult<Visit>>('/visits', params);
    }

    getVisit(visitId: string): Observable<Visit> {
        return this.api.get<Visit>(`/visits/${visitId}`);
    }

    createVisit(body: Record<string, unknown>): Observable<Visit> {
        return this.api.post<Visit>('/visits', body);
    }

    updateVisit(visitId: string, body: Record<string, unknown>): Observable<Visit> {
        return this.api.put<Visit>(`/visits/${visitId}`, body);
    }

    deleteVisit(visitId: string): Observable<void> {
        return this.api.delete<void>(`/visits/${visitId}`);
    }

    exportVisits(params: Record<string, string | number> = {}): Observable<Blob> {
        return this.api.download('/visits/export', params);
    }

    getCalendarVisits(start: string, end: string, search?: string): Observable<Visit[]> {
        const params: Record<string, string> = { start, end };
        if (search) params['search'] = search;
        return this.api.get<Visit[]>('/visits/calendar', params);
    }

    // ── Visitors / Escorts on a visit ──

    addVisitors(visitId: string, body: Record<string, unknown>): Observable<unknown> {
        return this.api.post(`/visits/${visitId}/visitors`, body);
    }

    getVisitors(visitId: string): Observable<VisitVisitor[]> {
        return this.api.get<VisitVisitor[]>(`/visits/${visitId}/visitors`);
    }

    updateVisitor(visitId: string, visitVisitorId: string, body: Record<string, unknown>): Observable<unknown> {
        return this.api.patch(`/visits/${visitId}/visitors/${visitVisitorId}`, body);
    }

    removeVisitor(visitId: string, visitVisitorId: string): Observable<void> {
        return this.api.delete<void>(`/visits/${visitId}/visitors/${visitVisitorId}`);
    }

    addEscorts(visitId: string, body: Record<string, unknown>): Observable<unknown> {
        return this.api.post(`/visits/${visitId}/escorts`, body);
    }

    getEscorts(visitId: string): Observable<VisitEscort[]> {
        return this.api.get<VisitEscort[]>(`/visits/${visitId}/escorts`);
    }

    updateEscort(visitId: string, visitEscortId: string, body: Record<string, unknown>): Observable<unknown> {
        return this.api.patch(`/visits/${visitId}/escorts/${visitEscortId}`, body);
    }

    removeEscort(visitId: string, visitEscortId: string): Observable<void> {
        return this.api.delete<void>(`/visits/${visitId}/escorts/${visitEscortId}`);
    }

    // ── Statuses / History ──

    getVisitorStatuses(visitId: string): Observable<unknown[]> {
        return this.api.get<unknown[]>(`/visits/${visitId}/visitor-statuses`);
    }

    getVisitHistory(visitId: string): Observable<unknown[]> {
        return this.api.get<unknown[]>(`/visits/${visitId}/visitor-history`);
    }

    // ── Print ──

    printCard(visitId: string, visitorId: string, body: Record<string, unknown>): Observable<unknown> {
        return this.api.post(`/visits/${visitId}/visitors/${visitorId}/print-card`, body);
    }

    // ── Parking Requests ──

    getParkingRequests(query: Record<string, unknown>): Observable<PaginatedResult<unknown>> {
        const params: Record<string, string> = {};
        if (query['page']) params['page'] = String(query['page']);
        if (query['limit']) params['limit'] = String(query['limit']);
        if (query['status']) params['status'] = String(query['status']);
        if (query['search']) params['search'] = String(query['search']);
        if (query['sortBy']) params['sortBy'] = String(query['sortBy']);
        if (query['sortOrder']) params['sortOrder'] = String(query['sortOrder']);
        if (query['filters']) params['filters'] = String(query['filters']);
        return this.api.get<PaginatedResult<unknown>>('/parking-requests', params);
    }

    getPendingParkingCount(): Observable<number> {
        return this.api.get<number>('/parking-requests/pending-count');
    }

    reviewParkingRequest(id: string, body: { status: string; reviewNote?: string }): Observable<unknown> {
        return this.api.patch(`/parking-requests/${id}/review`, body);
    }
}
