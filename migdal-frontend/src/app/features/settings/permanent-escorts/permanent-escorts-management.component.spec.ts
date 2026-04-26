import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { PermanentEscortsManagementComponent } from './permanent-escorts-management.component';
import { PermanentEscortsApiService } from '../services/permanent-escorts-api.service';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { PermissionService } from '@core/permissions/permission.service';
import { AuthService } from '@core/auth/auth.service';

describe('PermanentEscortsManagementComponent', () => {
    let component: PermanentEscortsManagementComponent;
    let fixture: ComponentFixture<PermanentEscortsManagementComponent>;

    const mockApi = {
        getAll: jasmine.createSpy('getAll').and.returnValue(of([])),
        getDomains: jasmine.createSpy('getDomains').and.returnValue(of([])),
        getUsersByDomain: jasmine.createSpy('getUsersByDomain').and.returnValue(of([])),
        add: jasmine.createSpy('add').and.returnValue(of({})),
        remove: jasmine.createSpy('remove').and.returnValue(of(void 0)),
    };
    const mockNotify = {
        success: jasmine.createSpy('success'),
        error: jasmine.createSpy('error'),
        info: jasmine.createSpy('info'),
        warn: jasmine.createSpy('warn'),
    };
    const mockConfirm = {
        confirm: jasmine.createSpy('confirm').and.returnValue(Promise.resolve(true)),
    };
    const mockPermissionService = {
        hasPermission: jasmine.createSpy('hasPermission').and.returnValue(true),
    };
    const mockAuthService = {
        currentUser$: of(null),
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PermanentEscortsManagementComponent, TranslateModule.forRoot()],
            providers: [
                { provide: PermanentEscortsApiService, useValue: mockApi },
                { provide: NotificationService, useValue: mockNotify },
                { provide: ConfirmService, useValue: mockConfirm },
                { provide: PermissionService, useValue: mockPermissionService },
                { provide: AuthService, useValue: mockAuthService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PermanentEscortsManagementComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create and load initial data', () => {
        expect(component).toBeTruthy();
        expect(mockApi.getAll).toHaveBeenCalled();
        expect(mockApi.getDomains).toHaveBeenCalled();
    });

    it('should require domain and user before add', () => {
        component.selectedDomainId = null;
        component.selectedUserId = null;

        component.addEscort();

        expect(component.domainValidationError).toBe('PERMANENT_ESCORTS.VALIDATION_DOMAIN_REQUIRED');
    });
});
