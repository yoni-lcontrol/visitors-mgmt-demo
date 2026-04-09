import { TestBed } from '@angular/core/testing';
import { WorkstationSessionService } from './workstation-session.service';
import { UserWebSocketService } from '../websocket/user-websocket.service';
import { ApiService } from '../api/api.service';
import { WsEvent } from '../websocket/ws-events.enum';
import { Observable, Subject, of, throwError } from 'rxjs';

describe('WorkstationSessionService', () => {
    let service: WorkstationSessionService;
    let mockUserWs: jasmine.SpyObj<UserWebSocketService>;
    let mockApi: jasmine.SpyObj<ApiService>;
    const eventSubjects = new Map<string, Subject<unknown>>();

    beforeEach(() => {
        eventSubjects.clear();
        mockUserWs = jasmine.createSpyObj('UserWebSocketService', ['on', 'emit']);
        mockUserWs.on.and.callFake(<T>(event: string): Observable<T> => {
            if (!eventSubjects.has(event)) {
                eventSubjects.set(event, new Subject());
            }
            return eventSubjects.get(event)!.asObservable() as Observable<T>;
        });

        mockApi = jasmine.createSpyObj('ApiService', ['post', 'get']);

        TestBed.configureTestingModule({
            providers: [
                WorkstationSessionService,
                { provide: UserWebSocketService, useValue: mockUserWs },
                { provide: ApiService, useValue: mockApi },
            ],
        });

        service = TestBed.inject(WorkstationSessionService);
    });

    it('should start with unbound state', () => {
        expect(service.currentState.bound).toBe(false);
    });

    it('should call REST API to bind', () => {
        mockApi.post.and.returnValue(of({
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'WS 01',
            devices: [],
        }));

        service.bindToWorkstation('ws-1');

        expect(mockApi.post).toHaveBeenCalledWith('/workstations/bind', { workstationId: 'ws-1' });
    });

    it('should update state on successful bind', () => {
        mockApi.post.and.returnValue(of({
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'WS 01',
            devices: [
                { providerType: 'printer', isConnected: true, agentVersion: '1.0', lastSeenAt: null, capabilities: null },
            ],
        }));

        service.bindToWorkstation('ws-1');

        expect(service.currentState.bound).toBe(true);
        expect(service.currentState.workstationId).toBe('ws-1');
        expect(service.isPrinterConnected()).toBe(true);
        expect(service.isScannerConnected()).toBe(false);
    });

    it('should update state on bind failure', () => {
        mockApi.post.and.returnValue(throwError(() => ({ error: { message: 'Access denied' } })));

        service.bindToWorkstation('ws-1');

        expect(service.currentState.bound).toBe(false);
        expect(service.currentState.error).toBe('Access denied');
    });

    it('should update state on WS bind success event', () => {
        service.initListeners();
        eventSubjects.get(WsEvent.WorkstationBindSuccess)?.next({
            workstationId: 'ws-1',
            code: 'WS-001',
            displayName: 'WS 01',
            devices: [
                { providerType: 'printer', isConnected: true, agentVersion: '1.0', lastSeenAt: null, capabilities: null },
            ],
        });

        expect(service.currentState.bound).toBe(true);
        expect(service.currentState.workstationId).toBe('ws-1');
    });

    it('should reset state', () => {
        mockApi.post.and.returnValue(of({
            workstationId: 'ws-1', code: 'WS-001', displayName: null, devices: [],
        }));
        service.bindToWorkstation('ws-1');
        service.reset();
        expect(service.currentState.bound).toBe(false);
        expect(service.currentState.workstationId).toBeNull();
    });

    describe('restoreSession', () => {
        it('should restore state from backend when session exists', () => {
            mockApi.get.and.returnValue(of({
                workstationId: 'ws-1',
                code: 'WS-001',
                displayName: 'WS 01',
                devices: [
                    { providerType: 'printer', isConnected: true, agentVersion: null, lastSeenAt: null, capabilities: null },
                    { providerType: 'scanner', isConnected: false, agentVersion: null, lastSeenAt: null, capabilities: null },
                ],
            }));

            service.restoreSession();

            expect(mockApi.get).toHaveBeenCalledWith('/workstations/session/current');
            expect(service.currentState.bound).toBe(true);
            expect(service.currentState.workstationId).toBe('ws-1');
            expect(service.isPrinterConnected()).toBe(true);
            expect(service.isScannerConnected()).toBe(false);
        });

        it('should not update state when backend returns null', () => {
            mockApi.get.and.returnValue(of(null));

            service.restoreSession();

            expect(service.currentState.bound).toBe(false);
        });

        it('should silently handle errors', () => {
            mockApi.get.and.returnValue(throwError(() => new Error('Network error')));

            service.restoreSession();

            expect(service.currentState.bound).toBe(false);
        });
    });
});
