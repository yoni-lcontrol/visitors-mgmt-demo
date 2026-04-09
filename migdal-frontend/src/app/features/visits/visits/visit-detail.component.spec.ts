import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, BehaviorSubject } from 'rxjs';
import { fakeAsync, tick } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { VisitDetailComponent } from './visit-detail.component';
import { ApiService } from '@core/api/api.service';
import { NotificationService } from '@core/notifications/notification.service';
import { ExcelImportService } from '@core/services/excel-import.service';
import { BlacklistCheckService } from '@core/services/blacklist-check.service';
import { VisitorSearchService } from '@core/services/visitor-search.service';
import { AdSearchService } from '@core/services/ad-search.service';
import { VisitsApiService } from '../services/visits-api.service';
import { VisitorPrintService, PrintState } from '../services/visitor-print.service';
import { DeviceStatusService } from '@core/services/device-status.service';
import { WorkstationSessionService, WorkstationState } from '@core/services/workstation-session.service';
import { PermissionService } from '@core/permissions/permission.service';
import { UserWebSocketService } from '@core/websocket/user-websocket.service';
import { ConfirmationService } from 'primeng/api';

describe('VisitDetailComponent', () => {
    let component: VisitDetailComponent;
    let fixture: ComponentFixture<VisitDetailComponent>;
    let mockApi: jasmine.SpyObj<ApiService>;
    let mockNotify: jasmine.SpyObj<NotificationService>;
    let mockBlacklistCheck: jasmine.SpyObj<BlacklistCheckService>;
    let mockPrintService: jasmine.SpyObj<VisitorPrintService>;
    let mockWorkstationSession: jasmine.SpyObj<WorkstationSessionService>;
    let mockDeviceStatus: jasmine.SpyObj<DeviceStatusService>;
    let printStateSubject: BehaviorSubject<PrintState>;
    let devicesSubject: BehaviorSubject<any[]>;

    const boundState: WorkstationState = {
        bound: true,
        workstationId: 'ws-1',
        code: 'WS-001',
        displayName: 'WS1',
        devices: [{ providerType: 'printer', isConnected: true, agentVersion: '1.0', lastSeenAt: '', capabilities: null }],
        error: null,
    };

    const unboundState: WorkstationState = {
        bound: false,
        workstationId: null,
        code: null,
        displayName: null,
        devices: [],
        error: null,
    };

    beforeEach(async () => {
        printStateSubject = new BehaviorSubject<PrintState>({ status: 'idle', correlationId: null, errorMessage: null });
        devicesSubject = new BehaviorSubject<any[]>([]);

        mockApi = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'delete']);
        mockApi.get.and.callFake((url: string): any => {
            if (url.includes('/visitors')) return of([]);
            if (url.includes('/escorts')) return of([]);
            if (url.includes('/access-levels')) return of({ items: [], total: 0, page: 1, limit: 100, totalPages: 0 });
            // /visits/:id
            return of({ id: 'visit-1', title: 'Test Visit', plannedStartTimeUtc: '2026-01-01T09:00:00Z', plannedEndTimeUtc: '2026-01-01T17:00:00Z' });
        });

        mockNotify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warn']);

        mockPrintService = jasmine.createSpyObj(
            'VisitorPrintService',
            ['initListeners', 'requestPrint', 'reset'],
            { state$: printStateSubject.asObservable() },
        );

        mockWorkstationSession = jasmine.createSpyObj(
            'WorkstationSessionService',
            ['isPrinterConnected', 'initListeners', 'bindToWorkstation', 'requestDeviceStatus', 'reset'],
            { currentState: boundState, state$: new BehaviorSubject<WorkstationState>(boundState).asObservable() },
        );
        mockWorkstationSession.isPrinterConnected.and.returnValue(true);

        mockDeviceStatus = jasmine.createSpyObj(
            'DeviceStatusService',
            ['initListeners', 'isPrinterConnected', 'isScannerConnected'],
            { devices$: devicesSubject.asObservable() },
        );

        const mockPermission = jasmine.createSpyObj('PermissionService', ['hasPermission']);
        mockPermission.hasPermission.and.returnValue(true);

        const mockUserWs = jasmine.createSpyObj('UserWebSocketService', ['on', 'emit', 'connect', 'disconnect']);
        mockUserWs.on.and.returnValue(new Subject());

        await TestBed.configureTestingModule({
            imports: [VisitDetailComponent, TranslateModule.forRoot()],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: ApiService, useValue: mockApi },
                { provide: NotificationService, useValue: mockNotify },
                { provide: ExcelImportService, useValue: jasmine.createSpyObj('ExcelImportService', ['importExcel']) },
                { provide: BlacklistCheckService, useValue: jasmine.createSpyObj('BlacklistCheckService', ['check', 'checkVehicle']) },
                { provide: VisitorSearchService, useValue: jasmine.createSpyObj('VisitorSearchService', ['search']) },
                { provide: AdSearchService, useValue: jasmine.createSpyObj('AdSearchService', ['searchPeople']) },
                { provide: VisitsApiService, useValue: { getVisit: () => of({ id: 'visit-1', title: 'Test Visit', plannedStartTimeUtc: '2026-01-01T09:00:00Z', plannedEndTimeUtc: '2026-01-01T17:00:00Z' }), getVisitors: () => of([]), getEscorts: () => of([]), getCheckInCodes: () => of([]), resendCode: jasmine.createSpy().and.returnValue(of({})), regenerateCode: jasmine.createSpy().and.returnValue(of({})) } },
                { provide: DeviceStatusService, useValue: mockDeviceStatus },
                { provide: WorkstationSessionService, useValue: mockWorkstationSession },
                { provide: PermissionService, useValue: mockPermission },
                { provide: UserWebSocketService, useValue: mockUserWs },
                { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
                ConfirmationService,
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: { paramMap: { get: () => 'visit-1' } },
                    },
                },
            ],
        })
            .overrideComponent(VisitDetailComponent, {
                set: { providers: [{ provide: VisitorPrintService, useValue: mockPrintService }] },
            })
            .compileComponents();

        mockBlacklistCheck = TestBed.inject(BlacklistCheckService) as jasmine.SpyObj<BlacklistCheckService>;

        fixture = TestBed.createComponent(VisitDetailComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('isPrinterAvailable', () => {
        it('should return true when workstation is bound and printer is connected', () => {
            expect(component.isPrinterAvailable()).toBeTrue();
        });

        it('should return false when workstation is not bound', () => {
            (Object.getOwnPropertyDescriptor(mockWorkstationSession, 'currentState')!.get as jasmine.Spy).and.returnValue(unboundState);
            expect(component.isPrinterAvailable()).toBeFalse();
        });

        it('should return false when printer is not connected', () => {
            mockWorkstationSession.isPrinterConnected.and.returnValue(false);
            expect(component.isPrinterAvailable()).toBeFalse();
        });

        it('should return false when both workstation unbound and no printer', () => {
            (Object.getOwnPropertyDescriptor(mockWorkstationSession, 'currentState')!.get as jasmine.Spy).and.returnValue(unboundState);
            mockWorkstationSession.isPrinterConnected.and.returnValue(false);
            expect(component.isPrinterAvailable()).toBeFalse();
        });
    });

    describe('getPrintCardTooltip', () => {
        it('should return PRINT_CARD when printer is available', () => {
            const tooltip = component.getPrintCardTooltip();
            expect(tooltip).toBe('VISITS.PRINT_CARD');
        });

        it('should return NO_WORKSTATION when workstation is not bound', () => {
            (Object.getOwnPropertyDescriptor(mockWorkstationSession, 'currentState')!.get as jasmine.Spy).and.returnValue(unboundState);
            const tooltip = component.getPrintCardTooltip();
            expect(tooltip).toBe('VISITS.PRINT_CARD_NO_WORKSTATION');
        });

        it('should return NO_PRINTER when workstation bound but no printer', () => {
            mockWorkstationSession.isPrinterConnected.and.returnValue(false);
            const tooltip = component.getPrintCardTooltip();
            expect(tooltip).toBe('VISITS.PRINT_CARD_NO_PRINTER');
        });
    });

    describe('printCard', () => {
        const mockVisitor = { id: 'vv-1', visitorId: 'vis-1' } as any;

        it('should call requestPrint when printer is available', () => {
            component.visitId = 'visit-1';
            component.printCard(mockVisitor);

            expect(mockPrintService.requestPrint).toHaveBeenCalledWith({
                visitId: 'visit-1',
                visitorId: 'vis-1',
            });
            expect(component.printingVisitorId).toBe('vv-1');
        });

        it('should not call requestPrint when workstation is not bound', () => {
            (Object.getOwnPropertyDescriptor(mockWorkstationSession, 'currentState')!.get as jasmine.Spy).and.returnValue(unboundState);
            component.printCard(mockVisitor);

            expect(mockPrintService.requestPrint).not.toHaveBeenCalled();
            expect(component.printingVisitorId).toBeNull();
        });

        it('should not call requestPrint when printer is not connected', () => {
            mockWorkstationSession.isPrinterConnected.and.returnValue(false);
            component.printCard(mockVisitor);

            expect(mockPrintService.requestPrint).not.toHaveBeenCalled();
            expect(component.printingVisitorId).toBeNull();
        });

        it('should not call requestPrint when already printing', () => {
            component.printingVisitorId = 'other-vv';
            component.printCard(mockVisitor);

            expect(mockPrintService.requestPrint).not.toHaveBeenCalled();
        });

        it('should not call requestPrint when visitor has no visitorId', () => {
            component.printCard({ id: 'vv-2', visitorId: null } as any);

            expect(mockPrintService.requestPrint).not.toHaveBeenCalled();
        });
    });

    describe('vehicle blacklist — add visitor', () => {
        it('onNewCarNumberChange should set checking then resolve', fakeAsync(() => {
            mockBlacklistCheck.checkVehicle.and.returnValue(of({ isBlacklisted: true, reason: 'stolen' }));
            component.onNewCarNumberChange(0, 'ABC123');
            expect(component.vehicleBlacklistMap.has(0)).toBeFalse(); // not yet — debounce
            tick(600);
            const status = component.vehicleBlacklistMap.get(0);
            expect(status).toEqual({ checking: false, blacklisted: true, reason: 'stolen' });
        }));

        it('onNewCarNumberChange should clear state for empty value', () => {
            component.vehicleBlacklistMap.set(0, { checking: false, blacklisted: true });
            component.onNewCarNumberChange(0, '');
            expect(component.vehicleBlacklistMap.has(0)).toBeFalse();
        });

        it('hasBlacklistedNewVisitor should return true when vehicle is blacklisted', () => {
            component.vehicleBlacklistMap.set(0, { checking: false, blacklisted: true });
            expect(component.hasBlacklistedNewVisitor()).toBeTrue();
        });

        it('hasBlacklistedNewVisitor should return false when vehicle is not blacklisted', () => {
            component.vehicleBlacklistMap.set(0, { checking: false, blacklisted: false });
            expect(component.hasBlacklistedNewVisitor()).toBeFalse();
        });

        it('onNewVehicleCheckboxChange should clear vehicle blacklist when unchecked', () => {
            const v = { hasVehicle: false, carNumber: 'X', vehicleType: 'car', requestParking: true } as any;
            component.newVisitors = [v];
            component.vehicleBlacklistMap.set(0, { checking: false, blacklisted: true });
            component.onNewVehicleCheckboxChange(v);
            expect(component.vehicleBlacklistMap.has(0)).toBeFalse();
            expect(v.carNumber).toBe('');
        });
    });

    describe('vehicle blacklist — edit visitor', () => {
        it('onEditCarNumberChange should set checking then resolve', fakeAsync(() => {
            mockBlacklistCheck.checkVehicle.and.returnValue(of({ isBlacklisted: false }));
            component.onEditCarNumberChange('DEF456');
            tick(600);
            expect(component.editVehicleBlacklistStatus).toEqual({ checking: false, blacklisted: false, reason: undefined });
        }));

        it('onEditCarNumberChange should clear state for empty value', () => {
            component.editVehicleBlacklistStatus = { checking: false, blacklisted: true };
            component.onEditCarNumberChange('');
            expect(component.editVehicleBlacklistStatus).toBeNull();
        });

        it('onEditVehicleCheckboxChange should clear vehicle blacklist when unchecked', () => {
            component.editingVisitor = { hasVehicle: false, carNumber: 'X', vehicleType: 'car' } as any;
            component.editVehicleBlacklistStatus = { checking: false, blacklisted: true };
            component.onEditVehicleCheckboxChange();
            expect(component.editVehicleBlacklistStatus).toBeNull();
            expect(component.editingVisitor!.carNumber).toBe('');
        });

        it('isEditVisitorValid should return false when vehicle is blacklisted', () => {
            component.editingVisitor = {
                firstName: 'A', lastName: 'B', personId: '123', accessLevelId: 'al-1',
                hasVehicle: false, carNumber: '', vehicleType: '',
            } as any;
            component.editVehicleBlacklistStatus = { checking: false, blacklisted: true };
            expect(component.isEditVisitorValid()).toBeFalse();
        });
    });

    describe('clearBlacklistState', () => {
        it('should clear all vehicle blacklist state', () => {
            component.vehicleBlacklistMap.set(0, { checking: false, blacklisted: true });
            component.editVehicleBlacklistStatus = { checking: false, blacklisted: true };
            (component as any).clearBlacklistState();
            expect(component.vehicleBlacklistMap.size).toBe(0);
            expect(component.editVehicleBlacklistStatus).toBeNull();
        });
    });

    describe('parking request — edit visitor', () => {
        it('openEditVisitorDialog should pre-populate requestParking when parkingRequest exists', () => {
            const vv = {
                id: 'vv-1',
                visitor: { firstName: 'A', lastName: 'B', email: '', phone: '', personId: '123', carNumber: 'ABC', vehicleType: 'car' },
                accessLevel: { id: 'al-1', name: 'Level' },
                parkingRequest: { status: 'Pending' },
            } as any;
            component.openEditVisitorDialog(vv);
            expect(component.editingVisitor!.requestParking).toBeTrue();
        });

        it('openEditVisitorDialog should set requestParking false when no parkingRequest', () => {
            const vv = {
                id: 'vv-2',
                visitor: { firstName: 'A', lastName: 'B', email: '', phone: '', personId: '456', carNumber: null, vehicleType: null },
                accessLevel: { id: 'al-1', name: 'Level' },
                parkingRequest: null,
            } as any;
            component.openEditVisitorDialog(vv);
            expect(component.editingVisitor!.requestParking).toBeFalse();
        });

        it('onEditVehicleCheckboxChange should reset requestParking when vehicle unchecked', () => {
            component.editingVisitor = { hasVehicle: false, carNumber: 'X', vehicleType: 'car', requestParking: true } as any;
            component.onEditVehicleCheckboxChange();
            expect(component.editingVisitor!.requestParking).toBeFalse();
        });
    });
});
