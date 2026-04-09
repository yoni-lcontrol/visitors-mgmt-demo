import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardComponent } from './dashboard.component';
import { PermissionService } from '../../core/permissions/permission.service';
import { AuthService } from '../../core/auth/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { VisitsApiService, TodaySummary, OnSiteResponse } from '../../features/visits/services/visits-api.service';
import { UserWebSocketService } from '../../core/websocket/user-websocket.service';
import { PaginatedResult } from '../../core/models/paginated-result.model';
import { Visit } from '../../core/models/entities.model';

describe('DashboardComponent', () => {
    let component: DashboardComponent;
    let fixture: ComponentFixture<DashboardComponent>;
    let permissionSpy: jasmine.SpyObj<PermissionService>;
    let authSpy: jasmine.SpyObj<AuthService>;
    let translationSpy: jasmine.SpyObj<TranslationService>;
    let visitsApiSpy: jasmine.SpyObj<VisitsApiService>;
    let wsSpy: jasmine.SpyObj<UserWebSocketService>;
    let routerSpy: jasmine.SpyObj<Router>;

    const mockSummary: TodaySummary = {
        totalVisitsToday: 12,
        arrivedToday: 4,
        checkedInToday: 3,
        completedToday: 5,
    };

    const mockOnSite: OnSiteResponse = {
        items: [],
        total: 0,
        page: 1,
        limit: 1,
        totalPages: 0,
        summary: { onSite: 7, arrived: 4, checkedIn: 3, blacklisted: 0 },
    };

    const mockUpcoming: PaginatedResult<Visit> = {
        items: [
            {
                id: 'v1',
                siteId: null,
                title: 'Morning Meeting',
                purposeOfVisit: null,
                buildingId: null,
                floor: null,
                plannedStartTimeUtc: '2026-04-04T09:00:00Z',
                plannedEndTimeUtc: '2026-04-04T10:00:00Z',
                createdByUserId: null,
                visitRequester: { firstName: 'Sarah', lastName: 'Cohen', phone: '123', email: 's@test.com' },
                statusSummary: { total: 3, pending: 2, arrived: 1, checkedIn: 0, checkedOut: 0 },
                createdAt: '2026-04-03T12:00:00Z',
                updatedAt: '2026-04-03T12:00:00Z',
            },
        ],
        total: 1,
        page: 1,
        limit: 5,
        totalPages: 1,
    };

    beforeEach(async () => {
        permissionSpy = jasmine.createSpyObj('PermissionService', ['hasPermission']);
        permissionSpy.hasPermission.and.callFake((perm: string) => true);

        authSpy = jasmine.createSpyObj('AuthService', [], {
            currentUser: { firstName: 'Admin' },
        });

        translationSpy = jasmine.createSpyObj('TranslationService', [], {
            currentLang: 'en',
        });

        visitsApiSpy = jasmine.createSpyObj('VisitsApiService', [
            'getTodaySummary',
            'getOnSiteVisitors',
            'getUpcomingVisits',
        ]);
        visitsApiSpy.getTodaySummary.and.returnValue(of(mockSummary));
        visitsApiSpy.getOnSiteVisitors.and.returnValue(of(mockOnSite));
        visitsApiSpy.getUpcomingVisits.and.returnValue(of(mockUpcoming));

        wsSpy = jasmine.createSpyObj('UserWebSocketService', ['on']);
        wsSpy.on.and.returnValue(new Subject());

        routerSpy = jasmine.createSpyObj('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [DashboardComponent, TranslateModule.forRoot()],
            providers: [
                { provide: PermissionService, useValue: permissionSpy },
                { provide: AuthService, useValue: authSpy },
                { provide: TranslationService, useValue: translationSpy },
                { provide: VisitsApiService, useValue: visitsApiSpy },
                { provide: UserWebSocketService, useValue: wsSpy },
                { provide: Router, useValue: routerSpy },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(DashboardComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        fixture.destroy();
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should display user name in welcome banner', () => {
        fixture.detectChanges();
        const h1 = fixture.nativeElement.querySelector('.welcome-text h1');
        expect(h1.textContent).toContain('Admin');
    });

    // ── KPI Cards ──

    it('should load today summary on init when user has visits permission', () => {
        fixture.detectChanges();
        expect(visitsApiSpy.getTodaySummary).toHaveBeenCalled();
    });

    it('should display 5 KPI cards when visits permission is granted', () => {
        fixture.detectChanges();
        const kpiCards = fixture.nativeElement.querySelectorAll('.kpi-card');
        expect(kpiCards.length).toBe(5);
    });

    it('should display correct KPI values from summary and on-site data', () => {
        fixture.detectChanges();
        const values: HTMLElement[] = fixture.nativeElement.querySelectorAll('.kpi-value');
        expect(values[0].textContent?.trim()).toBe('12'); // totalVisitsToday
        expect(values[1].textContent?.trim()).toBe('7');  // onSite
        expect(values[2].textContent?.trim()).toBe('4');  // arrived
        expect(values[3].textContent?.trim()).toBe('3');  // checkedIn
        expect(values[4].textContent?.trim()).toBe('5');  // completed
    });

    it('should not show KPI cards when user lacks visits permission', () => {
        permissionSpy.hasPermission.and.callFake((perm: string) => perm !== 'visits.read');
        fixture = TestBed.createComponent(DashboardComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        const kpiCards = fixture.nativeElement.querySelectorAll('.kpi-card');
        expect(kpiCards.length).toBe(0);
        expect(visitsApiSpy.getTodaySummary).not.toHaveBeenCalled();
    });

    // ── On-Site ──

    it('should load on-site summary on init', () => {
        fixture.detectChanges();
        expect(visitsApiSpy.getOnSiteVisitors).toHaveBeenCalledWith({ limit: 1 });
    });

    it('should navigate to on-site page when on-site card is clicked', () => {
        fixture.detectChanges();
        const onSiteCard = fixture.nativeElement.querySelector('.kpi-card.on-site');
        onSiteCard.click();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/visits/on-site']);
    });

    // ── Upcoming Visits ──

    it('should load upcoming visits on init', () => {
        fixture.detectChanges();
        expect(visitsApiSpy.getUpcomingVisits).toHaveBeenCalledWith(5);
    });

    it('should display upcoming visit rows', () => {
        fixture.detectChanges();
        const rows = fixture.nativeElement.querySelectorAll('.upcoming-row');
        expect(rows.length).toBe(1);
    });

    it('should display visit title and host name in upcoming row', () => {
        fixture.detectChanges();
        const title = fixture.nativeElement.querySelector('.upcoming-title');
        const host = fixture.nativeElement.querySelector('.upcoming-host');
        expect(title.textContent).toContain('Morning Meeting');
        expect(host.textContent).toContain('Sarah');
        expect(host.textContent).toContain('Cohen');
    });

    it('should display visitor count badge', () => {
        fixture.detectChanges();
        const badgeCount = fixture.nativeElement.querySelector('.badge-count');
        expect(badgeCount.textContent?.trim()).toBe('3');
    });

    it('should show empty state when no upcoming visits', () => {
        visitsApiSpy.getUpcomingVisits.and.returnValue(of({
            items: [], total: 0, page: 1, limit: 5, totalPages: 0,
        }));
        fixture.detectChanges();
        const emptyState = fixture.nativeElement.querySelector('.upcoming-empty');
        expect(emptyState).toBeTruthy();
    });

    it('should navigate to visit detail when upcoming row is clicked', () => {
        fixture.detectChanges();
        const row = fixture.nativeElement.querySelector('.upcoming-row');
        row.click();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/visits/v1']);
    });

    it('should navigate to visits page when "View all" is clicked', () => {
        fixture.detectChanges();
        const viewAll = fixture.nativeElement.querySelector('.view-all-link');
        viewAll.click();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/visits']);
    });

    // ── Real-time Updates ──

    it('should re-fetch data when websocket event fires', () => {
        const wsSubject = new Subject<void>();
        wsSpy.on.and.returnValue(wsSubject);

        fixture.detectChanges();
        visitsApiSpy.getTodaySummary.calls.reset();
        visitsApiSpy.getOnSiteVisitors.calls.reset();
        visitsApiSpy.getUpcomingVisits.calls.reset();

        wsSubject.next();

        expect(visitsApiSpy.getTodaySummary).toHaveBeenCalled();
        expect(visitsApiSpy.getOnSiteVisitors).toHaveBeenCalled();
        expect(visitsApiSpy.getUpcomingVisits).toHaveBeenCalled();
    });

    // ── Quick Access ──

    it('should display module navigation cards', () => {
        fixture.detectChanges();
        const navCards = fixture.nativeElement.querySelectorAll('.nav-card');
        expect(navCards.length).toBe(7);
    });

    it('should navigate when a module card is clicked', () => {
        fixture.detectChanges();
        const firstCard = fixture.nativeElement.querySelector('.nav-card');
        firstCard.click();
        expect(routerSpy.navigate).toHaveBeenCalled();
    });

    // ── Loading States ──

    it('should show loading indicators while data is being fetched', () => {
        visitsApiSpy.getTodaySummary.and.returnValue(new Subject());
        visitsApiSpy.getOnSiteVisitors.and.returnValue(new Subject());
        visitsApiSpy.getUpcomingVisits.and.returnValue(new Subject());

        fixture = TestBed.createComponent(DashboardComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        const values: HTMLElement[] = fixture.nativeElement.querySelectorAll('.kpi-value');
        expect(values[0].textContent?.trim()).toBe('...');
    });
});
