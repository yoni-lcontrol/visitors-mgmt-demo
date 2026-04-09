import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { VisitDialogComponent } from './visit-dialog.component';
import { ApiService } from '@core/api/api.service';
import { VisitsApiService } from '../services/visits-api.service';
import { NotificationService } from '@core/notifications/notification.service';
import { ExcelImportService } from '@core/services/excel-import.service';
import { BlacklistCheckService } from '@core/services/blacklist-check.service';
import { VisitorSearchService } from '@core/services/visitor-search.service';
import { AdSearchService } from '@core/services/ad-search.service';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('VisitDialogComponent', () => {
    let component: VisitDialogComponent;
    let fixture: ComponentFixture<VisitDialogComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [VisitDialogComponent, TranslateModule.forRoot(), NoopAnimationsModule],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: ApiService, useValue: jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete', 'download']) },
                { provide: VisitsApiService, useValue: jasmine.createSpyObj('VisitsApiService', ['create', 'update']) },
                { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
                { provide: ExcelImportService, useValue: jasmine.createSpyObj('ExcelImportService', ['importExcel']) },
                { provide: BlacklistCheckService, useValue: jasmine.createSpyObj('BlacklistCheckService', ['checkPerson', 'checkVehicle']) },
                { provide: VisitorSearchService, useValue: jasmine.createSpyObj('VisitorSearchService', ['search']) },
                { provide: AdSearchService, useValue: jasmine.createSpyObj('AdSearchService', ['searchPeople']) },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(VisitDialogComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('open() for new visit', () => {
        it('should set default start time to 08:00', () => {
            component.open();

            expect(component.form.plannedStartTime).toBeTruthy();
            expect(component.form.plannedStartTime!.getHours()).toBe(8);
            expect(component.form.plannedStartTime!.getMinutes()).toBe(0);
        });

        it('should set default end time to 17:00', () => {
            component.open();

            expect(component.form.plannedEndTime).toBeTruthy();
            expect(component.form.plannedEndTime!.getHours()).toBe(17);
            expect(component.form.plannedEndTime!.getMinutes()).toBe(0);
        });

        it('should not set default dates (user must pick)', () => {
            component.open();

            expect(component.form.plannedStartDate).toBeNull();
            expect(component.form.plannedEndDate).toBeNull();
        });

        it('should initialize one empty inline visitor', () => {
            component.open();

            expect(component.inlineVisitors.length).toBe(1);
            expect(component.inlineVisitors[0].firstName).toBe('');
        });
    });

    describe('open() for editing', () => {
        it('should use existing visit times, not defaults', () => {
            const visit = {
                id: 'uuid-1',
                title: 'Test Visit',
                plannedStartTimeUtc: '2026-04-10T10:30:00.000Z',
                plannedEndTimeUtc: '2026-04-10T14:00:00.000Z',
            } as any;

            component.open(visit);

            expect(component.form.plannedStartTime!.getUTCHours()).toBe(10);
            expect(component.form.plannedStartTime!.getUTCMinutes()).toBe(30);
            expect(component.form.plannedEndTime!.getUTCHours()).toBe(14);
            expect(component.form.plannedEndTime!.getUTCMinutes()).toBe(0);
        });
    });
});
