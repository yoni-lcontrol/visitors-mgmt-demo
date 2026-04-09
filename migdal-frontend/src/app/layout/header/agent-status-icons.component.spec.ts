import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { AgentStatusIconsComponent } from './agent-status-icons.component';
import {
    WorkstationSessionService,
    WorkstationState,
} from '../../core/services/workstation-session.service';
import { DeviceStatusService } from '../../core/services/device-status.service';
import { WorkstationDeviceStatus } from '../../core/models/ws-payloads.model';

describe('AgentStatusIconsComponent', () => {
    let component: AgentStatusIconsComponent;
    let fixture: ComponentFixture<AgentStatusIconsComponent>;
    let stateSubject: BehaviorSubject<WorkstationState>;
    let devicesSubject: BehaviorSubject<WorkstationDeviceStatus[]>;

    const INITIAL_STATE: WorkstationState = {
        bound: false,
        workstationId: null,
        code: null,
        displayName: null,
        devices: [],
        error: null,
    };

    beforeEach(async () => {
        stateSubject = new BehaviorSubject<WorkstationState>(INITIAL_STATE);
        devicesSubject = new BehaviorSubject<WorkstationDeviceStatus[]>([]);

        await TestBed.configureTestingModule({
            imports: [AgentStatusIconsComponent, TranslateModule.forRoot()],
            providers: [
                {
                    provide: WorkstationSessionService,
                    useValue: { state$: stateSubject.asObservable() },
                },
                {
                    provide: DeviceStatusService,
                    useValue: { devices$: devicesSubject.asObservable() },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AgentStatusIconsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should not render when workstation is not bound', () => {
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.agent-status-icons')).toBeNull();
    });

    it('should render two icons when workstation is bound', () => {
        stateSubject.next({
            ...INITIAL_STATE,
            bound: true,
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'WS 01',
            devices: [],
        });
        devicesSubject.next([]);
        fixture.detectChanges();

        const icons = fixture.nativeElement.querySelectorAll('.agent-icon');
        expect(icons.length).toBe(2);
    });

    it('should show both icons as disconnected when no devices connected', () => {
        stateSubject.next({
            ...INITIAL_STATE,
            bound: true,
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'WS 01',
            devices: [],
        });
        devicesSubject.next([]);
        fixture.detectChanges();

        const icons = fixture.nativeElement.querySelectorAll('.agent-icon');
        expect(icons[0].classList.contains('disconnected')).toBe(true);
        expect(icons[1].classList.contains('disconnected')).toBe(true);
    });

    it('should show printer as connected when printer device is connected', () => {
        stateSubject.next({
            ...INITIAL_STATE,
            bound: true,
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'WS 01',
            devices: [
                { providerType: 'printer', isConnected: true, agentVersion: null, lastSeenAt: null, capabilities: null },
            ],
        });
        devicesSubject.next([
            { providerType: 'printer', isConnected: true, agentVersion: null, lastSeenAt: null, capabilities: null },
        ]);
        fixture.detectChanges();

        const icons = fixture.nativeElement.querySelectorAll('.agent-icon');
        expect(icons[0].classList.contains('connected')).toBe(true);
        expect(icons[1].classList.contains('disconnected')).toBe(true);
    });

    it('should show scanner as connected when scanner device is connected', () => {
        stateSubject.next({
            ...INITIAL_STATE,
            bound: true,
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'WS 01',
            devices: [],
        });
        devicesSubject.next([
            { providerType: 'scanner', isConnected: true, agentVersion: null, lastSeenAt: null, capabilities: null },
        ]);
        fixture.detectChanges();

        const icons = fixture.nativeElement.querySelectorAll('.agent-icon');
        expect(icons[0].classList.contains('disconnected')).toBe(true);
        expect(icons[1].classList.contains('connected')).toBe(true);
    });

    it('should show both connected when both devices are connected', () => {
        stateSubject.next({
            ...INITIAL_STATE,
            bound: true,
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'WS 01',
            devices: [],
        });
        devicesSubject.next([
            { providerType: 'printer', isConnected: true, agentVersion: null, lastSeenAt: null, capabilities: null },
            { providerType: 'scanner', isConnected: true, agentVersion: null, lastSeenAt: null, capabilities: null },
        ]);
        fixture.detectChanges();

        const icons = fixture.nativeElement.querySelectorAll('.agent-icon');
        expect(icons[0].classList.contains('connected')).toBe(true);
        expect(icons[1].classList.contains('connected')).toBe(true);
    });

    it('should update when device status changes dynamically', () => {
        stateSubject.next({
            ...INITIAL_STATE,
            bound: true,
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'WS 01',
            devices: [],
        });
        devicesSubject.next([]);
        fixture.detectChanges();

        let icons = fixture.nativeElement.querySelectorAll('.agent-icon');
        expect(icons[0].classList.contains('disconnected')).toBe(true);

        // Printer comes online
        devicesSubject.next([
            { providerType: 'printer', isConnected: true, agentVersion: null, lastSeenAt: null, capabilities: null },
        ]);
        fixture.detectChanges();

        icons = fixture.nativeElement.querySelectorAll('.agent-icon');
        expect(icons[0].classList.contains('connected')).toBe(true);
    });

    it('should hide when workstation is unbound', () => {
        stateSubject.next({
            ...INITIAL_STATE,
            bound: true,
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'WS 01',
            devices: [],
        });
        devicesSubject.next([]);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.agent-status-icons')).not.toBeNull();

        stateSubject.next(INITIAL_STATE);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.agent-status-icons')).toBeNull();
    });

    it('should render printer icon with pi-print class', () => {
        stateSubject.next({
            ...INITIAL_STATE,
            bound: true,
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'WS 01',
            devices: [],
        });
        devicesSubject.next([]);
        fixture.detectChanges();

        const printerIcon = fixture.nativeElement.querySelector('.agent-icon:first-child i');
        expect(printerIcon.classList.contains('pi-print')).toBe(true);
    });

    it('should render scanner icon with pi-camera class', () => {
        stateSubject.next({
            ...INITIAL_STATE,
            bound: true,
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'WS 01',
            devices: [],
        });
        devicesSubject.next([]);
        fixture.detectChanges();

        const scannerIcon = fixture.nativeElement.querySelector('.agent-icon:last-child i');
        expect(scannerIcon.classList.contains('pi-camera')).toBe(true);
    });
});
