import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { BuildingsApiService, Building } from '../../services/buildings-api.service';

@Component({
    selector: 'app-building-list',
    standalone: true,
    imports: [FormsModule, TranslateModule, TableModule, DialogModule, HasPermissionDirective],
    template: `
        <div class="page-header">
            <div class="header-info">
                <h1>{{ 'BUILDINGS.TITLE' | translate }}</h1>
                <p class="header-description">{{ 'BUILDINGS.DESCRIPTION' | translate }}</p>
            </div>
            <div class="header-actions" *hasPermission="'buildings.create'">
                <button class="btn btn-primary" (click)="openDialog()">
                    <i class="pi pi-plus"></i> {{ 'BUILDINGS.CREATE' | translate }}
                </button>
            </div>
        </div>

        <div class="card table-card">
            <p-table [value]="buildings" [loading]="loading" [paginator]="true" [rows]="20"
                [showCurrentPageReport]="true" [rowsPerPageOptions]="[10, 20, 50]"
                dataKey="id"
                styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
                currentPageReportTemplate="{first}-{last} / {totalRecords}"
                paginatorDropdownAppendTo="body">
                <ng-template pTemplate="header">
                    <tr>
                        <th>{{ 'BUILDINGS.NAME' | translate }}</th>
                        <th>{{ 'BUILDINGS.ADDRESS' | translate }}</th>
                        <th>{{ 'COMMON.STATUS' | translate }}</th>
                        <th style="width: 120px">{{ 'COMMON.ACTIONS' | translate }}</th>
                    </tr>
                </ng-template>
                <ng-template pTemplate="body" let-b>
                    <tr>
                        <td>{{ b.name }}</td>
                        <td>{{ b.address || '-' }}</td>
                        <td>
                            <span class="status-badge" [class.active]="b.active" [class.inactive]="!b.active">
                                {{ (b.active ? 'COMMON.ACTIVE' : 'COMMON.INACTIVE') | translate }}
                            </span>
                        </td>
                        <td class="actions">
                                <button class="btn-icon" *hasPermission="'buildings.update'" (click)="openDialog(b)" [title]="'COMMON.EDIT' | translate">
                                    <i class="pi pi-pencil"></i>
                                </button>
                        </td>
                    </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                    <tr>
                        <td colspan="4" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog [header]="editing ? ('BUILDINGS.EDIT' | translate) : ('BUILDINGS.CREATE' | translate)"
            [(visible)]="showDialog" [modal]="true" [style]="{width: '500px'}" [draggable]="false">
            @if (showDialog) {
                <div class="dialog-form">
                    <div class="field">
                        <label>{{ 'BUILDINGS.NAME' | translate }} <span class="required">*</span></label>
                        <input type="text" [(ngModel)]="form.name" required #nameField="ngModel" [placeholder]="'PLACEHOLDER.ENTER_BUILDING_NAME' | translate" />
                        @if (nameField.invalid && nameField.touched) {
                            <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                        }
                    </div>
                    <div class="field">
                        <label>{{ 'BUILDINGS.ADDRESS' | translate }}</label>
                        <input type="text" [(ngModel)]="form.address" [placeholder]="'PLACEHOLDER.ENTER_ADDRESS' | translate" />
                    </div>
                    <div class="field">
                        <label>{{ 'COMMON.STATUS' | translate }}</label>
                        <select [(ngModel)]="form.active">
                            <option [ngValue]="true">{{ 'COMMON.ACTIVE' | translate }}</option>
                            <option [ngValue]="false">{{ 'COMMON.INACTIVE' | translate }}</option>
                        </select>
                    </div>
                </div>
            }
            <ng-template pTemplate="footer">
                <button class="btn btn-secondary" (click)="showDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
                <button class="btn btn-primary" [disabled]="!form.name.trim() || saving" (click)="save()">
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
        .status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.8rem; font-weight: 500; }
        .status-badge.active { background: #e8f5e9; color: #2e7d32; }
        .status-badge.inactive { background: #fce4ec; color: #c62828; }
        .actions { display: flex; gap: 0.3rem; align-items: center; }
        .dialog-form { display: flex; flex-direction: column; gap: 1rem; }
        .dialog-form .field label { display: block; margin-bottom: 0.35rem; font-weight: 500; font-size: 0.9rem; }
        .dialog-form .field input, .dialog-form .field select { width: 100%; padding: 0.5rem 0.75rem; border: 1.5px solid var(--color-border, #e4e2f0); border-radius: var(--radius-sm, 6px); font-size: 0.9rem; font-family: inherit; }
        .dialog-form .field input:focus, .dialog-form .field select:focus { outline: none; border-color: var(--color-accent, #6c63ff); box-shadow: 0 0 0 3px rgba(108,99,255,0.12); }
        .dialog-form .field input.ng-invalid.ng-touched, .dialog-form .field select.ng-invalid.ng-touched { border-color: var(--color-danger, #e53935); background: rgba(229, 57, 53, 0.02); }
        .dialog-form .field input.ng-invalid.ng-touched:focus, .dialog-form .field select.ng-invalid.ng-touched:focus { border-color: var(--color-danger, #e53935); box-shadow: 0 0 0 3px rgba(229, 57, 53, 0.10); }
        .required { color: var(--color-danger, #e74c3c); }
    `],
})
export class BuildingListComponent implements OnInit {
    private buildingsApi = inject(BuildingsApiService);
    private notify = inject(NotificationService);

    buildings: Building[] = [];
    loading = false;
    showDialog = false;
    editing: Building | null = null;
    saving = false;
    form = { name: '', address: '', active: true };

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        this.buildingsApi.getAll({ limit: 100 }).subscribe({
            next: (r) => { this.buildings = r.items; this.loading = false; },
            error: () => { this.loading = false; },
        });
    }

    openDialog(building?: Building): void {
        this.editing = building ?? null;
        if (building) {
            this.form = { name: building.name, address: building.address ?? '', active: building.active };
        } else {
            this.form = { name: '', address: '', active: true };
        }
        this.showDialog = true;
    }

    save(): void {
        this.saving = true;
        const dto = {
            name: this.form.name.trim(),
            address: this.form.address.trim() || undefined,
            active: this.form.active,
        };

        const obs = this.editing
            ? this.buildingsApi.update(this.editing.id, dto)
            : this.buildingsApi.create(dto);

        obs.subscribe({
            next: () => {
                this.showDialog = false;
                this.saving = false;
                this.notify.success('COMMON.SUCCESS');
                this.loadData();
            },
            error: (err) => {
                this.saving = false;
                this.notify.error(err);
            },
        });
    }
}
