import { TestBed } from '@angular/core/testing';
import { ScannerEventService, ScanResultData } from './scanner-event.service';
import { UserWebSocketService } from '../websocket/user-websocket.service';
import { WorkstationSessionService, WorkstationState } from './workstation-session.service';
import { WsEvent } from '../websocket/ws-events.enum';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

describe('ScannerEventService', () => {
    let service: ScannerEventService;
    let mockUserWs: jasmine.SpyObj<UserWebSocketService>;
    let wsStateSubject: BehaviorSubject<WorkstationState>;
    const eventSubjects = new Map<string, Subject<unknown>>();

    const UNBOUND_STATE: WorkstationState = {
        bound: false,
        workstationId: null,
        code: null,
        displayName: null,
        devices: [],
        error: null,
    };

    const BOUND_STATE: WorkstationState = {
        bound: true,
        workstationId: 'ws-1',
        code: 'WS-001',
        displayName: 'WS 01',
        devices: [{ providerType: 'scanner', isConnected: true, deviceConnected: true, agentVersion: null, lastSeenAt: null, capabilities: null }],
        error: null,
    };

    beforeEach(() => {
        eventSubjects.clear();
        mockUserWs = jasmine.createSpyObj('UserWebSocketService', ['on', 'emit']);
        mockUserWs.on.and.callFake(<T>(event: string): Observable<T> => {
            if (!eventSubjects.has(event)) {
                eventSubjects.set(event, new Subject());
            }
            return eventSubjects.get(event)!.asObservable() as Observable<T>;
        });

        wsStateSubject = new BehaviorSubject<WorkstationState>(UNBOUND_STATE);

        TestBed.configureTestingModule({
            providers: [
                ScannerEventService,
                { provide: UserWebSocketService, useValue: mockUserWs },
                {
                    provide: WorkstationSessionService,
                    useValue: {
                        state$: wsStateSubject.asObservable(),
                        currentState: UNBOUND_STATE,
                    },
                },
            ],
        });

        service = TestBed.inject(ScannerEventService);
    });

    it('should start with empty state', () => {
        expect(service.currentState.lastResult).toBeNull();
        expect(service.currentState.lastError).toBeNull();
        expect(service.currentState.correlationId).toBeNull();
    });

    it('should not subscribe to scanner events when workstation is not bound', () => {
        service.initListeners();
        expect(mockUserWs.on).not.toHaveBeenCalled();
    });

    it('should subscribe to scanner events when workstation becomes bound', () => {
        service.initListeners();
        wsStateSubject.next(BOUND_STATE);

        expect(mockUserWs.on).toHaveBeenCalledWith(WsEvent.ScannerActionCompleted);
        expect(mockUserWs.on).toHaveBeenCalledWith(WsEvent.ScannerActionFailed);
    });

    it('should update state when scanner action completed event is received', () => {
        service.initListeners();
        wsStateSubject.next(BOUND_STATE);

        const scanResult: ScanResultData = {
            personId: '123456',
            firstName: 'John',
            lastName: 'Doe',
            identifyNumber: '987654321',
            image: 'base64-image-data',
        };

        eventSubjects.get(WsEvent.ScannerActionCompleted)?.next({
            correlationId: 'corr-1',
            result: scanResult,
        });

        expect(service.currentState.lastResult).toEqual(scanResult);
        expect(service.currentState.lastError).toBeNull();
        expect(service.currentState.correlationId).toBe('corr-1');
    });

    it('should update state when scanner action failed event is received', () => {
        service.initListeners();
        wsStateSubject.next(BOUND_STATE);

        eventSubjects.get(WsEvent.ScannerActionFailed)?.next({
            correlationId: 'corr-2',
            reason: 'Scanner hardware not available',
        });

        expect(service.currentState.lastResult).toBeNull();
        expect(service.currentState.lastError).toBe('Scanner hardware not available');
        expect(service.currentState.correlationId).toBe('corr-2');
    });

    it('should unsubscribe from scanner events when workstation becomes unbound', () => {
        service.initListeners();
        wsStateSubject.next(BOUND_STATE);

        // Should have subscribed
        expect(mockUserWs.on).toHaveBeenCalledTimes(2);

        // Unbind
        wsStateSubject.next(UNBOUND_STATE);

        // New events should not update state
        const scanResult: ScanResultData = {
            personId: '123',
            firstName: 'Test',
            lastName: 'User',
            identifyNumber: '111',
            image: '',
        };

        eventSubjects.get(WsEvent.ScannerActionCompleted)?.next({
            correlationId: 'corr-3',
            result: scanResult,
        });

        // State should remain at initial since scanner subs were torn down
        expect(service.currentState.lastResult).toBeNull();
    });

    it('should reset state and unsubscribe all on reset()', () => {
        service.initListeners();
        wsStateSubject.next(BOUND_STATE);

        eventSubjects.get(WsEvent.ScannerActionCompleted)?.next({
            correlationId: 'corr-4',
            result: { personId: '1', firstName: 'A', lastName: 'B', identifyNumber: '2', image: '' },
        });

        expect(service.currentState.lastResult).not.toBeNull();

        service.reset();

        expect(service.currentState.lastResult).toBeNull();
        expect(service.currentState.lastError).toBeNull();
        expect(service.currentState.correlationId).toBeNull();
    });

    it('should not double-subscribe on multiple initListeners calls', () => {
        service.initListeners();
        service.initListeners();
        wsStateSubject.next(BOUND_STATE);

        // Should only subscribe once (2 events: completed + failed)
        expect(mockUserWs.on).toHaveBeenCalledTimes(2);
    });
});
