import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { CardTemplateListComponent } from './card-template-list.component';
import { CardTemplateApiService } from '../../services/card-template-api.service';
import { PermissionService } from '../../../../core/permissions/permission.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { WorkstationSessionService } from '../../../../core/services/workstation-session.service';
import { Router } from '@angular/router';

describe('CardTemplateListComponent', () => {
    let component: CardTemplateListComponent;
    let fixture: ComponentFixture<CardTemplateListComponent>;
    let mockApi: jasmine.SpyObj<CardTemplateApiService>;
    let mockNotification: jasmine.SpyObj<NotificationService>;
    let mockWorkstationSession: jasmine.SpyObj<WorkstationSessionService>;

    const mockTemplates = [
        {
            id: 'tpl-1',
            name: 'Badge A',
            description: 'Standard badge',
            cardWidthMm: 86,
            cardHeightMm: 54,
            orientation: 'landscape',
            elementsJson: '[]',
            backgroundColor: '#fff',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            isActive: true,
        },
    ];

    beforeEach(async () => {
        mockApi = jasmine.createSpyObj('CardTemplateApiService', ['getAll', 'delete', 'testPrint']);
        mockApi.getAll.and.returnValue(of(mockTemplates as any));
        mockApi.testPrint.and.returnValue(of({ correlationId: 'corr-1', status: 'queued' }));

        mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warn']);

        mockWorkstationSession = jasmine.createSpyObj(
            'WorkstationSessionService',
            ['isPrinterConnected'],
            {
                currentState: {
                    bound: true,
                    workstationId: 'ws-1',
                    machineId: 'm1',
                    hostname: 'host',
                    displayName: 'WS1',
                    devices: [{ providerType: 'printer', isConnected: true }],
                    error: null,
                },
            },
        );
        mockWorkstationSession.isPrinterConnected.and.returnValue(true);

        const mockPermission = jasmine.createSpyObj('PermissionService', ['hasPermission']);
        mockPermission.hasPermission.and.returnValue(true);

        const mockRouter = jasmine.createSpyObj('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [CardTemplateListComponent, TranslateModule.forRoot()],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: CardTemplateApiService, useValue: mockApi },
                { provide: NotificationService, useValue: mockNotification },
                { provide: WorkstationSessionService, useValue: mockWorkstationSession },
                { provide: PermissionService, useValue: mockPermission },
                { provide: Router, useValue: mockRouter },
                ConfirmationService,
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CardTemplateListComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load templates on init', () => {
        expect(mockApi.getAll).toHaveBeenCalled();
        expect(component.templates.length).toBe(1);
    });

    describe('isPrinterAvailable', () => {
        it('should return true when workstation is bound and printer is connected', () => {
            expect(component.isPrinterAvailable()).toBeTrue();
        });

        it('should return false when workstation is not bound', () => {
            (Object.getOwnPropertyDescriptor(mockWorkstationSession, 'currentState')!.get as jasmine.Spy).and.returnValue({
                bound: false, workstationId: null, code: null, displayName: null, devices: [], error: null,
            });
            expect(component.isPrinterAvailable()).toBeFalse();
        });
    });

    describe('onTestPrint', () => {
        it('should call testPrint API with template id', () => {
            component.onTestPrint(mockTemplates[0] as any);

            expect(mockApi.testPrint).toHaveBeenCalledWith('tpl-1');
            expect(mockNotification.success).toHaveBeenCalled();
        });

        it('should show success notification after print sent', () => {
            component.onTestPrint(mockTemplates[0] as any);
            expect(mockNotification.success).toHaveBeenCalled();
        });

        it('should show error notification on failure', () => {
            mockApi.testPrint.and.returnValue(throwError(() => new Error('Print failed')));
            component.onTestPrint(mockTemplates[0] as any);
            expect(mockNotification.error).toHaveBeenCalled();
        });

        it('should set and clear printingTemplateId during request', () => {
            expect(component.printingTemplateId).toBeNull();
            component.onTestPrint(mockTemplates[0] as any);
            // After synchronous subscribe completes, should be null again
            expect(component.printingTemplateId).toBeNull();
        });

        it('should warn when workstation is not bound', () => {
            (Object.getOwnPropertyDescriptor(mockWorkstationSession, 'currentState')!.get as jasmine.Spy).and.returnValue({
                bound: false, workstationId: null, code: null, displayName: null, devices: [], error: null,
            });

            component.onTestPrint(mockTemplates[0] as any);

            expect(mockNotification.warn).toHaveBeenCalled();
            expect(mockApi.testPrint).not.toHaveBeenCalled();
        });
    });
});
