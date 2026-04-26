import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { VisitListComponent } from './visit-list.component';
import { ApiService } from '@core/api/api.service';
import { NotificationService } from '@core/notifications/notification.service';
import { ExcelImportService } from '@core/services/excel-import.service';
import { BlacklistCheckService } from '@core/services/blacklist-check.service';
import { VisitorSearchService } from '@core/services/visitor-search.service';
import { AdSearchService } from '@core/services/ad-search.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { AuthService } from '@core/auth/auth.service';

describe('VisitListComponent', () => {
    let component: VisitListComponent;
    let fixture: ComponentFixture<VisitListComponent>;
    let mockApi: jasmine.SpyObj<ApiService>;

    beforeEach(async () => {
        mockApi = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'delete', 'download']);
        mockApi.get.and.returnValue(of({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }));

        await TestBed.configureTestingModule({
            imports: [VisitListComponent, TranslateModule.forRoot()],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: ApiService, useValue: mockApi },
                { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
                { provide: ExcelImportService, useValue: jasmine.createSpyObj('ExcelImportService', ['importExcel']) },
                { provide: BlacklistCheckService, useValue: jasmine.createSpyObj('BlacklistCheckService', ['check']) },
                { provide: VisitorSearchService, useValue: jasmine.createSpyObj('VisitorSearchService', ['search']) },
                { provide: AdSearchService, useValue: jasmine.createSpyObj('AdSearchService', ['search']) },
                { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
                {
                    provide: AuthService,
                    useValue: {
                        currentUser: {
                            id: 'user-1',
                            username: 'admin',
                            firstName: 'Admin',
                            lastName: 'User',
                            email: null,
                            phone: null,
                            sector: null,
                            roles: ['Admin'],
                            permissions: ['visits.read', 'visits.create', 'visits.update', 'visits.delete'],
                        },
                    },
                },
                ConfirmationService,
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(VisitListComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render the time filter button group', () => {
        const el: HTMLElement = fixture.nativeElement;
        const btns = el.querySelectorAll('.time-filter-btn');
        expect(btns.length).toBe(4); // Today, Future, History, Archive
    });

    it('should have "Today" active by default', () => {
        const el: HTMLElement = fixture.nativeElement;
        const btns = el.querySelectorAll('.time-filter-btn');
        expect(btns[0].classList.contains('active')).toBeTrue(); // Today
        expect(btns[3].classList.contains('active')).toBeFalse(); // Archive
    });

    it('should change active state when a filter button is clicked', () => {
        component.onTimeFilterChange('future');
        fixture.detectChanges();
        const el: HTMLElement = fixture.nativeElement;
        const btns = el.querySelectorAll('.time-filter-btn');
        expect(btns[0].classList.contains('active')).toBeFalse(); // Today
        expect(btns[1].classList.contains('active')).toBeTrue(); // Future
    });

    it('should reset paginator when changing time filter', () => {
        component.first = 40;
        component.onTimeFilterChange('future');
        expect(component.first).toBe(0);
    });

    it('should reload data when time filter changes', () => {
        mockApi.get.calls.reset();
        component.onTimeFilterChange('history');
        expect(mockApi.get).toHaveBeenCalled();
        const callArgs = mockApi.get.calls.mostRecent().args;
        expect(callArgs[0]).toBe('/visits');
        expect((callArgs[1] as any)['timeFilter']).toBe('history');
    });

    it('should not pass timeFilter when "Archive" is selected', () => {
        component.onTimeFilterChange('today');
        mockApi.get.calls.reset();
        component.onTimeFilterChange(null);
        const callArgs = mockApi.get.calls.mostRecent().args;
        expect((callArgs[1] as any)['timeFilter']).toBeUndefined();
    });

    it('should pass global search and timeFilter together', () => {
        component.activeTimeFilter = 'history';
        const event = { first: 0, rows: 20, sortField: 'plannedStartTimeUtc', sortOrder: -1, filters: { global: { value: 'meeting' } } };
        component.loadData(event);
        const callArgs = mockApi.get.calls.mostRecent().args;
        expect((callArgs[1] as any)['search']).toBe('meeting');
        expect((callArgs[1] as any)['timeFilter']).toBe('history');
    });

    it('should call download with current filters when exportData is called', () => {
        mockApi.download.and.returnValue(of(new Blob()));
        component.activeTimeFilter = 'today';
        component.exportData();
        expect(mockApi.download).toHaveBeenCalledWith('/visits/export', jasmine.objectContaining({
            sortBy: 'plannedStartTimeUtc',
            timeFilter: 'today',
        }));
    });

    it('should not pass timeFilter in export when Archive is active', () => {
        mockApi.download.and.returnValue(of(new Blob()));
        component.activeTimeFilter = null;
        component.exportData();
        const callArgs = mockApi.download.calls.mostRecent().args;
        expect((callArgs[1] as any)['timeFilter']).toBeUndefined();
    });

    it('should open requester dialog with visit data', () => {
        const visit = { id: '1', visitRequester: { firstName: 'John', lastName: 'Doe', phone: '123', email: 'j@d.com' } } as any;
        component.showRequester(visit);
        expect(component.selectedVisit).toBe(visit);
        expect(component.requesterDialogVisible).toBeTrue();
    });

    it('should handle visit with no requester', () => {
        const visit = { id: '2', visitRequester: null } as any;
        component.showRequester(visit);
        expect(component.selectedVisit).toBe(visit);
        expect(component.requesterDialogVisible).toBeTrue();
    });
});
