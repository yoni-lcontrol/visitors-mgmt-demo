import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { SelectWorkstationComponent } from './select-workstation.component';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth/auth.service';
import { WorkstationSessionService, WorkstationState } from '@core/services/workstation-session.service';
import { DeviceStatusService } from '@core/services/device-status.service';
import { TranslationService } from '@core/i18n/translation.service';
import { AccessibleWorkstation } from '@core/models/entities.model';

describe('SelectWorkstationComponent', () => {
    let component: SelectWorkstationComponent;
    let fixture: ComponentFixture<SelectWorkstationComponent>;
    let router: jasmine.SpyObj<Router>;
    let mockApi: jasmine.SpyObj<ApiService>;
    let mockAuth: jasmine.SpyObj<AuthService>;
    let mockWsSession: jasmine.SpyObj<WorkstationSessionService>;
    let mockDeviceStatus: jasmine.SpyObj<DeviceStatusService>;
    let stateSubject: BehaviorSubject<WorkstationState>;

    const mockWorkstations: AccessibleWorkstation[] = [
        {
            id: 'ws-1',
            code: 'WS-001',
            displayName: 'Reception Desk 1',
            machineId: null,
            hostname: null,
            devices: [
                { providerType: 'printer', isConnected: true, agentVersion: '1.0' },
            ],
        },
        {
            id: 'ws-2',
            code: 'WS-002',
            displayName: 'Lobby',
            machineId: null,
            hostname: null,
            devices: [],
        },
    ];

    const initialState: WorkstationState = {
        bound: false,
        workstationId: null,
        code: null,
        displayName: null,
        devices: [],
        error: null,
    };

    beforeEach(async () => {
        stateSubject = new BehaviorSubject<WorkstationState>(initialState);

        mockApi = jasmine.createSpyObj('ApiService', ['get']);
        mockApi.get.and.returnValue(of(mockWorkstations));

        mockAuth = jasmine.createSpyObj('AuthService', ['logout']);

        mockWsSession = jasmine.createSpyObj(
            'WorkstationSessionService',
            ['initListeners', 'bindToWorkstation', 'reset'],
            { state$: stateSubject.asObservable() },
        );

        mockDeviceStatus = jasmine.createSpyObj('DeviceStatusService', ['initListeners']);

        router = jasmine.createSpyObj('Router', ['navigate']);

        const mockTranslation = {
            currentLang: 'en',
            toggleLanguage: jasmine.createSpy('toggleLanguage'),
        };

        await TestBed.configureTestingModule({
            imports: [SelectWorkstationComponent, TranslateModule.forRoot()],
            providers: [
                { provide: ApiService, useValue: mockApi },
                { provide: AuthService, useValue: mockAuth },
                { provide: WorkstationSessionService, useValue: mockWsSession },
                { provide: DeviceStatusService, useValue: mockDeviceStatus },
                { provide: Router, useValue: router },
                { provide: TranslationService, useValue: mockTranslation },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SelectWorkstationComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load accessible workstations on init', () => {
        expect(mockApi.get).toHaveBeenCalledWith('/workstations/accessible');
        expect(component.workstations.length).toBe(2);
        expect(component.loading).toBe(false);
    });

    it('should initialize workstation and device listeners', () => {
        expect(mockWsSession.initListeners).toHaveBeenCalled();
        expect(mockDeviceStatus.initListeners).toHaveBeenCalled();
    });

    it('should bind to workstation on selection', () => {
        component.selectWorkstation(mockWorkstations[0]);

        expect(component.selectedId).toBe('ws-1');
        expect(component.binding).toBe(true);
        expect(mockWsSession.bindToWorkstation).toHaveBeenCalledWith('ws-1');
    });

    it('should navigate to / on successful bind', () => {
        stateSubject.next({
            bound: true,
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'Reception Desk 1',
            devices: [],
            error: null,
        });

        expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should show error on bind failure', () => {
        component.selectWorkstation(mockWorkstations[0]);

        stateSubject.next({
            ...initialState,
            error: 'Access denied',
        });

        expect(component.binding).toBe(false);
        expect(component.errorMessage).toBe('Access denied');
    });

    it('should navigate to /dashboard on skip', () => {
        component.skip();
        expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should call authService.logout on logout', () => {
        component.logout();
        expect(mockAuth.logout).toHaveBeenCalled();
    });

    it('should render workstation items', () => {
        const items = fixture.nativeElement.querySelectorAll('.ws-item');
        expect(items.length).toBe(2);
    });

    it('should show device indicators for workstations with devices', () => {
        const dots = fixture.nativeElement.querySelectorAll('.device-dot');
        expect(dots.length).toBe(1); // only ws-1 has devices
    });

    it('should auto-skip to /dashboard when no accessible workstations', () => {
        mockApi.get.and.returnValue(of([]));
        const newFixture = TestBed.createComponent(SelectWorkstationComponent);
        newFixture.detectChanges();

        expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
});
