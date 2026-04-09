import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { SettingsListComponent } from './settings-list.component';
import { ApiService } from '@core/api/api.service';
import { NotificationService } from '@core/notifications/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { Setting } from '@core/models/entities.model';

describe('SettingsListComponent', () => {
    let component: SettingsListComponent;
    let fixture: ComponentFixture<SettingsListComponent>;
    let mockApi: jasmine.SpyObj<ApiService>;
    let mockNotify: jasmine.SpyObj<NotificationService>;

    const mockSettings: Setting[] = [
        { id: '1', key: 'app.name', value: 'Migdal', type: 'string', group: 'general', label: 'Application Name', description: null, isPublic: true },
        { id: '5', key: 'app.timezone', value: 'Asia/Jerusalem', type: 'string', group: 'general', label: 'Timezone', description: 'Default timezone', isPublic: false },
        { id: '2', key: 'retention.auditLogsMonths', value: '3', type: 'number', group: 'retention', label: 'Audit Logs Retention', description: 'Months', isPublic: false },
        { id: '3', key: 'retention.visitsMonths', value: '3', type: 'number', group: 'retention', label: 'Visits Retention', description: 'Months', isPublic: false },
        { id: '4', key: 'retention.deviceCommandLogsMonths', value: '3', type: 'number', group: 'retention', label: 'Device Command Logs Retention', description: 'Months', isPublic: false },
    ];

    beforeEach(async () => {
        mockApi = jasmine.createSpyObj('ApiService', ['get', 'patch']);
        mockApi.get.and.returnValue(of(mockSettings.map(s => ({ ...s }))));
        mockApi.patch.and.returnValue(of({}));

        mockNotify = jasmine.createSpyObj('NotificationService', ['success', 'error']);

        await TestBed.configureTestingModule({
            imports: [SettingsListComponent, TranslateModule.forRoot()],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: ApiService, useValue: mockApi },
                { provide: NotificationService, useValue: mockNotify },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsListComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load settings on init', () => {
        expect(mockApi.get).toHaveBeenCalledWith('/settings');
        expect(component.settings.length).toBe(5);
        expect(component.loading).toBeFalse();
    });

    it('should group settings correctly', () => {
        expect(component.groups).toContain('general');
        expect(component.groups).toContain('retention');
    });

    it('should return correct settings from getByGroup', () => {
        const retention = component.getByGroup('retention');
        expect(retention.length).toBe(3);
        expect(retention.some(s => s.key === 'retention.deviceCommandLogsMonths')).toBeTrue();

        const general = component.getByGroup('general');
        expect(general.length).toBe(2);
    });

    it('should identify retention group', () => {
        expect(component.isRetentionGroup('retention')).toBeTrue();
        expect(component.isRetentionGroup('general')).toBeFalse();
    });

    it('should not be dirty initially', () => {
        expect(component.dirty).toBeFalse();
        expect(component.hasUnsavedChanges()).toBeFalse();
    });

    describe('change detection', () => {
        it('should detect dirty state when any setting value changes', () => {
            const setting = component.settings.find(s => s.key === 'app.name')!;
            setting.value = 'New Name';
            component.onSettingChange();
            expect(component.dirty).toBeTrue();
            expect(component.hasUnsavedChanges()).toBeTrue();
        });

        it('should detect dirty state for retention setting changes', () => {
            const setting = component.settings.find(s => s.key === 'retention.auditLogsMonths')!;
            setting.value = '6';
            component.onSettingChange();
            expect(component.dirty).toBeTrue();
        });

        it('should not be dirty when value is reset to original', () => {
            const setting = component.settings.find(s => s.key === 'app.name')!;
            setting.value = 'New Name';
            component.onSettingChange();
            expect(component.dirty).toBeTrue();

            setting.value = 'Migdal';
            component.onSettingChange();
            expect(component.dirty).toBeFalse();
        });

        it('should track validity based on retention constraints', () => {
            const setting = component.settings.find(s => s.key === 'retention.deviceCommandLogsMonths')!;
            setting.value = '999';
            component.onSettingChange();
            expect(component.valid).toBeFalse();
        });

        it('should be valid when all retention values are in range', () => {
            const setting = component.settings.find(s => s.key === 'retention.deviceCommandLogsMonths')!;
            setting.value = '6';
            component.onSettingChange();
            expect(component.valid).toBeTrue();
        });
    });

    describe('retention validation', () => {
        it('should validate all retention months with min 1 max 120', () => {
            for (const key of ['retention.auditLogsMonths', 'retention.visitsMonths', 'retention.deviceCommandLogsMonths']) {
                const setting = mockSettings.find(s => s.key === key)!;
                expect(component.getRetentionMin(setting)).toBe(1);
                expect(component.getRetentionMax(setting)).toBe(120);
            }
        });

        it('should flag empty value as invalid', () => {
            const setting = { ...mockSettings.find(s => s.key === 'retention.deviceCommandLogsMonths')!, value: '' };
            expect(component.isRetentionInvalid(setting)).toBeTrue();
        });

        it('should flag out-of-range months as invalid', () => {
            const setting = { ...mockSettings.find(s => s.key === 'retention.deviceCommandLogsMonths')!, value: '200' };
            expect(component.isRetentionInvalid(setting)).toBeTrue();
        });

        it('should accept valid values in range', () => {
            const months = { ...mockSettings.find(s => s.key === 'retention.deviceCommandLogsMonths')!, value: '6' };
            expect(component.isRetentionInvalid(months)).toBeFalse();
        });
    });

    describe('saveAll', () => {
        it('should save only changed settings', () => {
            const setting = component.settings.find(s => s.key === 'app.name')!;
            setting.value = 'New Name';
            component.onSettingChange();

            component.saveAll();

            expect(mockApi.patch).toHaveBeenCalledTimes(1);
            expect(mockApi.patch).toHaveBeenCalledWith('/settings/app.name', { value: 'New Name' });
        });

        it('should save multiple changed settings', () => {
            const s1 = component.settings.find(s => s.key === 'app.name')!;
            s1.value = 'New Name';
            const s2 = component.settings.find(s => s.key === 'retention.auditLogsMonths')!;
            s2.value = '6';
            component.onSettingChange();

            component.saveAll();

            expect(mockApi.patch).toHaveBeenCalledTimes(2);
            expect(mockApi.patch).toHaveBeenCalledWith('/settings/app.name', { value: 'New Name' });
            expect(mockApi.patch).toHaveBeenCalledWith('/settings/retention.auditLogsMonths', { value: '6' });
        });

        it('should reset dirty state after successful save', () => {
            const setting = component.settings.find(s => s.key === 'app.name')!;
            setting.value = 'New Name';
            component.onSettingChange();

            component.saveAll();

            expect(component.dirty).toBeFalse();
            expect(component.saving).toBeFalse();
            expect(mockNotify.success).toHaveBeenCalledWith('SETTINGS.SAVE_SUCCESS');
        });

        it('should not save when no changes detected', () => {
            component.saveAll();
            expect(mockApi.patch).not.toHaveBeenCalled();
        });

        it('should handle save errors', () => {
            mockApi.patch.and.returnValue(throwError(() => new Error('Server error')));

            const setting = component.settings.find(s => s.key === 'app.name')!;
            setting.value = 'New Name';
            component.onSettingChange();

            component.saveAll();

            expect(component.saving).toBeFalse();
            expect(mockNotify.error).toHaveBeenCalled();
        });

        it('should set saving flag during save', () => {
            const setting = component.settings.find(s => s.key === 'app.name')!;
            setting.value = 'New Name';
            component.onSettingChange();

            // Before saveAll
            expect(component.saving).toBeFalse();

            component.saveAll();

            // After completion (sync observable resolves immediately)
            expect(component.saving).toBeFalse();
        });
    });

    describe('hasUnsavedChanges', () => {
        it('should return false when no changes', () => {
            expect(component.hasUnsavedChanges()).toBeFalse();
        });

        it('should return true when changes exist', () => {
            const setting = component.settings.find(s => s.key === 'app.name')!;
            setting.value = 'Changed';
            component.onSettingChange();
            expect(component.hasUnsavedChanges()).toBeTrue();
        });

        it('should return false after save', () => {
            const setting = component.settings.find(s => s.key === 'app.name')!;
            setting.value = 'Changed';
            component.onSettingChange();

            component.saveAll();

            expect(component.hasUnsavedChanges()).toBeFalse();
        });
    });
});
