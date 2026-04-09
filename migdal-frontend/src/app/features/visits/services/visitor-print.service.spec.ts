import { TestBed } from '@angular/core/testing';
import { VisitorPrintService, PrintStatus } from './visitor-print.service';
import { UserWebSocketService } from '../../../core/websocket/user-websocket.service';
import { ApiService } from '../../../core/api/api.service';
import { WsEvent } from '../../../core/websocket/ws-events.enum';
import { Observable, Subject, of, throwError } from 'rxjs';

describe('VisitorPrintService', () => {
    let service: VisitorPrintService;
    let mockUserWs: jasmine.SpyObj<UserWebSocketService>;
    let mockApi: jasmine.SpyObj<ApiService>;
    const eventSubjects = new Map<string, Subject<unknown>>();

    beforeEach(() => {
        eventSubjects.clear();
        mockUserWs = jasmine.createSpyObj('UserWebSocketService', ['on', 'emit', 'connect', 'disconnect']);
        mockUserWs.on.and.callFake(<T>(event: string): Observable<T> => {
            if (!eventSubjects.has(event)) {
                eventSubjects.set(event, new Subject());
            }
            return eventSubjects.get(event)!.asObservable() as Observable<T>;
        });
        mockApi = jasmine.createSpyObj('ApiService', ['post']);

        TestBed.configureTestingModule({
            providers: [
                VisitorPrintService,
                { provide: UserWebSocketService, useValue: mockUserWs },
                { provide: ApiService, useValue: mockApi },
            ],
        });

        service = TestBed.inject(VisitorPrintService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should start with idle state', () => {
        expect(service.currentState.status).toBe('idle');
    });

    it('should send print request via HTTP API', () => {
        mockApi.post.and.returnValue(of({ correlationId: 'corr-1', status: 'queued' }));
        service.requestPrint({ visitId: 'v1', visitorId: 'vis1' });
        expect(mockApi.post).toHaveBeenCalledWith(
            '/visits/v1/visitors/vis1/print-card',
            {},
        );
    });

    it('should transition to requesting then queued on successful API response', () => {
        mockApi.post.and.returnValue(of({ correlationId: 'corr-1', status: 'queued' }));
        service.requestPrint({ visitId: 'v1', visitorId: 'vis1' });
        expect(service.currentState.status).toBe('queued');
        expect(service.currentState.correlationId).toBe('corr-1');
    });

    it('should transition to failed on API error', () => {
        mockApi.post.and.returnValue(throwError(() => ({ error: { error: { message: 'No printer' } } })));
        service.requestPrint({ visitId: 'v1', visitorId: 'vis1' });
        expect(service.currentState.status).toBe('failed');
        expect(service.currentState.errorMessage).toBe('No printer');
    });

    it('should report isProcessing correctly', () => {
        expect(service.isProcessing).toBe(false);
        mockApi.post.and.returnValue(of({ correlationId: 'corr-1', status: 'queued' }));
        service.requestPrint({ visitId: 'v1', visitorId: 'vis1' });
        // After successful API call, status is 'queued' which is processing
        expect(service.isProcessing).toBe(true);
    });

    it('should transition to queued on WS print-queued event', () => {
        service.initListeners();
        eventSubjects.get(WsEvent.VisitsVisitorPrintQueued)?.next({
            correlationId: 'corr-1', visitId: 'v1', visitorId: 'vis1',
        });
        expect(service.currentState.status).toBe('queued');
        expect(service.currentState.correlationId).toBe('corr-1');
    });

    it('should transition to printing on print-started event', () => {
        service.initListeners();
        eventSubjects.get(WsEvent.VisitsVisitorPrintStarted)?.next({
            correlationId: 'corr-1',
        });
        expect(service.currentState.status).toBe('printing');
    });

    it('should transition to completed on print-completed event', () => {
        service.initListeners();
        eventSubjects.get(WsEvent.VisitsVisitorPrintCompleted)?.next({
            correlationId: 'corr-1', visitId: 'v1', visitorId: 'vis1',
        });
        expect(service.currentState.status).toBe('completed');
    });

    it('should transition to failed on print-failed event', () => {
        service.initListeners();
        eventSubjects.get(WsEvent.VisitsVisitorPrintFailed)?.next({
            correlationId: 'corr-1', visitId: 'v1', visitorId: 'vis1', reason: 'Agent offline',
        });
        expect(service.currentState.status).toBe('failed');
        expect(service.currentState.errorMessage).toBe('Agent offline');
    });

    it('should reset to idle state', () => {
        mockApi.post.and.returnValue(of({ correlationId: 'corr-1', status: 'queued' }));
        service.requestPrint({ visitId: 'v1', visitorId: 'vis1' });
        service.reset();
        expect(service.currentState.status).toBe('idle');
    });
});
