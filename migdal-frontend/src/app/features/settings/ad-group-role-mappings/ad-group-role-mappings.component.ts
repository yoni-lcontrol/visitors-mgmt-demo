import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { RolesApiService } from '../../roles/services/roles-api.service';
import {
    AdGroupRoleMapping,
    AdGroupRoleMappingsApiService,
} from '../services/ad-group-role-mappings-api.service';

@Component({
    selector: 'app-ad-group-role-mappings',
    standalone: true,
    imports: [
        FormsModule,
        TranslateModule,
        TableModule,
        DialogModule,
        DropdownModule,
        HasPermissionDirective,
    ],
    template: `
        <div class="page-header">
            <div class="header-info">
                <h1>{{ 'AD_GROUP_ROLE_MAPPINGS.TITLE' | translate }}</h1>
                <p class="header-description">{{ 'AD_GROUP_ROLE_MAPPINGS.DESCRIPTION' | translate }}</p>
            </div>
            <div class="header-actions" *hasPermission="'settings.update'">
                <button class="btn btn-primary" (click)="openDialog()">
                    <i class="pi pi-plus"></i> {{ 'AD_GROUP_ROLE_MAPPINGS.CREATE' | translate }}
                </button>
            </div>
        </div>

        <div class="card table-card">
            <p-table [value]="mappings" [loading]="loading" [paginator]="true" [rows]="20"
                [showCurrentPageReport]="true" [rowsPerPageOptions]="[10, 20, 50]"
                dataKey="id"
                styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
                currentPageReportTemplate="{first}-{last} / {totalRecords}"
                paginatorDropdownAppendTo="body">
                <ng-template pTemplate="header">
                    <tr>
                        <th>{{ 'AD_GROUP_ROLE_MAPPINGS.GROUP_NAME' | translate }}</th>
                        <th>{{ 'AD_GROUP_ROLE_MAPPINGS.ROLE' | translate }}</th>
                        <th style="width: 140px">{{ 'COMMON.ACTIONS' | translate }}</th>
                    </tr>
                </ng-template>
                <ng-template pTemplate="body" let-m>
                    <tr>
                        <td>{{ m.groupName }}</td>
                        <td>{{ m.role?.name || '-' }}</td>
                        <td class="actions">
                            <button class="btn-icon" *hasPermission="'settings.update'" (click)="openDialog(m)" [title]="'COMMON.EDIT' | translate">
                                <i class="pi pi-pencil"></i>
                            </button>
                            <button class="btn-icon danger" *hasPermission="'settings.update'" (click)="remove(m)" [title]="'COMMON.DELETE' | translate">
                                <i class="pi pi-trash"></i>
                            </button>
                        </td>
                    </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                    <tr>
                        <td colspan="3" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog [header]="editing ? ('AD_GROUP_ROLE_MAPPINGS.EDIT' | translate) : ('AD_GROUP_ROLE_MAPPINGS.CREATE' | translate)"
            [(visible)]="showDialog" [modal]="true" [style]="{width: '600px'}" [draggable]="false">
            @if (showDialog) {
                <div class="dialog-form">
                    <div class="field">
                        <label>{{ 'AD_GROUP_ROLE_MAPPINGS.GROUP_NAME' | translate }} <span class="required">*</span></label>
                        <input type="text" [(ngModel)]="form.groupName" required #groupNameField="ngModel" [placeholder]="'AD_GROUP_ROLE_MAPPINGS.GROUP_NAME_PLACEHOLDER' | translate" />
                        @if (groupNameField.invalid && groupNameField.touched) {
                            <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                        }
                    </div>

                    <div class="field">
                        <label>{{ 'AD_GROUP_ROLE_MAPPINGS.ROLE' | translate }} <span class="required">*</span></label>
                        <p-dropdown
                            [(ngModel)]="form.roleId"
                            [options]="roleOptions"
                            optionLabel="label"
                            optionValue="value"
                            [placeholder]="'AD_GROUP_ROLE_MAPPINGS.SELECT_ROLE' | translate"
                            appendTo="body"
                            [style]="{'width': '100%'}"
                            required
                            #roleField="ngModel"
                        ></p-dropdown>
                        @if (roleField.invalid && roleField.touched) {
                            <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                        }
                    </div>
                </div>
            }
            <ng-template pTemplate="footer">
                <button class="btn btn-secondary" (click)="showDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
                <button class="btn btn-primary" [disabled]="!isFormValid() || saving" (click)="save()">
                    @if (saving) { <i class="pi pi-spin pi-spinner"></i> }
                    {{ 'COMMON.SAVE' | translate }}
                </button>
            </ng-template>
        </p-dialog>
    `,
    styles: [`
        :host { display: block; }
        .table-card { padding: 0; overflow: hidden; }
        :host ::ng-deep .table-card .p-datatable-wrapper { padding-top: 0.85rem; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .header-info h1 { margin: 0; font-size: 1.5rem; }
        .header-description { color: var(--color-text-secondary, #5c5a78); margin: 0.25rem 0 0; font-size: 0.9rem; }
        .actions { display: flex; gap: 0.3rem; align-items: center; }
        .dialog-form { display: flex; flex-direction: column; gap: 1rem; }
        .dialog-form .field label { display: block; margin-bottom: 0.35rem; font-weight: 500; font-size: 0.9rem; }
        .dialog-form .field input { width: 100%; padding: 0.5rem 0.75rem; border: 1.5px solid var(--color-border, #e4e2f0); border-radius: var(--radius-sm, 6px); font-size: 0.9rem; font-family: inherit; }
        .dialog-form .field input:focus { outline: none; border-color: var(--color-accent, #6c63ff); box-shadow: 0 0 0 3px rgba(108,99,255,0.12); }
        .dialog-form .field input.ng-invalid.ng-touched { border-color: var(--color-danger, #e53935); background: rgba(229, 57, 53, 0.02); }
        .dialog-form .field input.ng-invalid.ng-touched:focus { border-color: var(--color-danger, #e53935); box-shadow: 0 0 0 3px rgba(229, 57, 53, 0.10); }
        .required { color: var(--color-danger, #e74c3c); }
    `],
})
export class AdGroupRoleMappingsComponent implements OnInit {
    private readonly mappingsApi = inject(AdGroupRoleMappingsApiService);
    private readonly rolesApi = inject(RolesApiService);
    private readonly notify = inject(NotificationService);
    private readonly confirmService = inject(ConfirmService);

    mappings: AdGroupRoleMapping[] = [];
    roleOptions: Array<{ label: string; value: string }> = [];

    loading = false;
    saving = false;
    showDialog = false;
    editing: AdGroupRoleMapping | null = null;

    form = { groupName: '', roleId: '' };

    ngOnInit(): void {
        this.loadRoles();
        this.loadMappings();
    }

    loadMappings(): void {
        this.loading = true;
        this.mappingsApi.getAll().subscribe({
            next: (result) => {
                this.mappings = result;
                this.loading = false;
            },
            error: (err) => {
                this.loading = false;
                this.notify.error(err);
            },
        });
    }

    loadRoles(): void {
        this.rolesApi.getAll({ page: 1, limit: 100 }).subscribe({
            next: (result) => {
                this.roleOptions = (result.items || [])
                    .map((role) => ({ label: role.name, value: role.id }))
                    .sort((a, b) => a.label.localeCompare(b.label));
            },
            error: (err) => this.notify.error(err),
        });
    }

    openDialog(mapping?: AdGroupRoleMapping): void {
        this.editing = mapping ?? null;

        if (mapping) {
            this.form = {
                groupName: mapping.groupName,
                roleId: mapping.roleId,
            };
        } else {
            this.form = { groupName: '', roleId: '' };
        }

        this.showDialog = true;
    }

    isFormValid(): boolean {
        return !!this.form.groupName.trim() && !!this.form.roleId;
    }

    save(): void {
        if (!this.isFormValid()) {
            return;
        }

        this.saving = true;

        const dto = {
            groupName: this.form.groupName.trim(),
            roleId: this.form.roleId,
        };

        const request$ = this.editing
            ? this.mappingsApi.update(this.editing.id, dto)
            : this.mappingsApi.create(dto);

        request$.subscribe({
            next: () => {
                this.saving = false;
                this.showDialog = false;
                this.notify.success('COMMON.SUCCESS');
                this.loadMappings();
            },
            error: (err) => {
                this.saving = false;
                this.notify.error(err);
            },
        });
    }

    async remove(mapping: AdGroupRoleMapping): Promise<void> {
        const confirmed = await this.confirmService.confirm('AD_GROUP_ROLE_MAPPINGS.CONFIRM_DELETE', {
            groupName: mapping.groupName,
        });

        if (!confirmed) {
            return;
        }

        this.mappingsApi.delete(mapping.id).subscribe({
            next: () => {
                this.notify.success('COMMON.DELETE_SUCCESS');
                this.loadMappings();
            },
            error: (err) => this.notify.error(err),
        });
    }
}
