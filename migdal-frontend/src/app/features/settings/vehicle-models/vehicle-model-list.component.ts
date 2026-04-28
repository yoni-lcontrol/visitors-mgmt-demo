import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { ConfirmService } from '@core/services/confirm.service';
import { downloadBlob } from '@core/utils/download.util';
import {
    VehicleModel,
    VehicleModelPayload,
    VehicleModelsApiService,
} from '../services/vehicle-models-api.service';

interface VehicleModelForm {
    manufacturer: string;
    model: string;
}

@Component({
    selector: 'app-vehicle-model-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        TableModule,
        InputTextModule,
        DialogModule,
        DropdownModule,
    ],
    template: `
        <div class="page-header">
            <div>
                <h1>{{ 'VEHICLE_MODELS.TITLE' | translate }}</h1>
                <p class="page-description">{{ 'VEHICLE_MODELS.DESCRIPTION' | translate }}</p>
            </div>
            <div class="header-actions">
                <button class="btn btn-outline" *ngIf="canExportVehicleModels" (click)="exportData()" [disabled]="exporting">
                    <i class="pi" [class.pi-file-excel]="!exporting" [class.pi-spinner]="exporting" [class.pi-spin]="exporting"></i>
                    {{ 'COMMON.EXPORT' | translate }}
                </button>
                <button class="btn btn-primary" *ngIf="canCreateVehicleModels" (click)="openDialog()">
                    <i class="pi pi-plus"></i> {{ 'VEHICLE_MODELS.CREATE' | translate }}
                </button>
            </div>
        </div>

        <div class="card table-card">
            <p-table
                #dt
                [value]="vehicleModels"
                [lazy]="true"
                (onLazyLoad)="onLazyLoad($event)"
                [loading]="loading"
                [totalRecords]="totalRecords"
                [paginator]="true"
                [rows]="rows"
                [first]="first"
                [showCurrentPageReport]="true"
                [rowsPerPageOptions]="[10, 20, 50]"
                [globalFilterFields]="['manufacturer', 'model']"
                dataKey="id"
                styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
                currentPageReportTemplate="{first}-{last} / {totalRecords}"
                paginatorDropdownAppendTo="body"
            >
                <ng-template pTemplate="caption">
                    <div class="table-header">
                        <span class="p-input-icon-left search-box">
                            <i class="pi pi-search"></i>
                            <input pInputText type="text" (input)="dt.filterGlobal($any($event.target).value, 'contains')" [placeholder]="'COMMON.SEARCH' | translate" />
                        </span>
                    </div>
                </ng-template>
                <ng-template pTemplate="header">
                    <tr>
                        <th pSortableColumn="manufacturer">{{ 'VEHICLE_MODELS.MANUFACTURER' | translate }} <p-sortIcon field="manufacturer" /> <p-columnFilter field="manufacturer" type="text" display="menu"></p-columnFilter></th>
                        <th pSortableColumn="model">{{ 'VEHICLE_MODELS.MODEL' | translate }} <p-sortIcon field="model" /> <p-columnFilter field="model" type="text" display="menu"></p-columnFilter></th>
                        <th *ngIf="hasActions">{{ 'COMMON.ACTIONS' | translate }}</th>
                    </tr>
                </ng-template>
                <ng-template pTemplate="body" let-item>
                    <tr>
                        <td>{{ item.manufacturer }}</td>
                        <td>{{ item.model }}</td>
                        <td class="actions-cell" *ngIf="hasActions">
                            <button class="btn-icon" *ngIf="canUpdateVehicleModels" (click)="openDialog(item)" [title]="'COMMON.EDIT' | translate">
                                <i class="pi pi-pencil"></i>
                            </button>
                            <button class="btn-icon danger" *ngIf="canDeleteVehicleModels" (click)="deleteItem(item)" [title]="'COMMON.DELETE' | translate">
                                <i class="pi pi-trash"></i>
                            </button>
                        </td>
                    </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                    <tr>
                        <td [attr.colspan]="hasActions ? 3 : 2" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog [header]="editingItem ? ('VEHICLE_MODELS.EDIT' | translate) : ('VEHICLE_MODELS.CREATE' | translate)"
            [(visible)]="showDialog" (onHide)="onDialogHide()" [modal]="true" [style]="{ width: '560px' }" [draggable]="false">
            @if (showDialog) {
                <div class="dialog-form">
                    <div class="field">
                        <label>{{ 'VEHICLE_MODELS.MANUFACTURER' | translate }} <span class="required">*</span></label>
                        <p-dropdown
                            [options]="manufacturerOptions"
                            [(ngModel)]="form.manufacturer"
                            optionLabel="label"
                            optionValue="value"
                            [placeholder]="'VEHICLE_MODELS.SELECT_MANUFACTURER' | translate"
                            appendTo="body"
                            [style]="{ width: '100%' }">
                        </p-dropdown>
                    </div>
                    <div class="field">
                        <label>{{ 'VEHICLE_MODELS.MODEL' | translate }} <span class="required">*</span></label>
                        <input type="text" pInputText [(ngModel)]="form.model" [placeholder]="'VEHICLE_MODELS.MODEL_PLACEHOLDER' | translate" />
                    </div>
                </div>
            }
            <ng-template pTemplate="footer">
                <button class="btn btn-secondary" (click)="showDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
                <button class="btn btn-primary" (click)="save()" [disabled]="!isFormValid() || saving">
                    @if (saving) {
                        <i class="pi pi-spin pi-spinner"></i>
                    }
                    {{ 'COMMON.SAVE' | translate }}
                </button>
            </ng-template>
        </p-dialog>
    `,
    styles: [`
        :host { display: block; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
        .page-header h1 { margin: 0; font-size: 1.5rem; }
        .page-description { margin: 0.35rem 0 0; color: var(--color-text-secondary, #5c5a78); }
        .header-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .table-card { padding: 0; overflow: hidden; }
        .table-header { display: flex; justify-content: flex-start; }
        .search-box { position: relative; min-width: 280px; }
        .search-box i { position: absolute; top: 50%; transform: translateY(-50%); inset-inline-start: 0.75rem; color: var(--color-text-muted, #9896ad); }
        .search-box input { width: 100%; padding-inline-start: 2.2rem; }
        .actions-cell { display: flex; gap: 0.35rem; align-items: center; }
        .dialog-form { display: flex; flex-direction: column; gap: 1rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .field label { font-weight: 500; font-size: 0.9rem; }
        .required { color: var(--color-danger, #e53935); }
        .empty { text-align: center; padding: 1rem; }
        @media (max-width: 900px) {
            .page-header { flex-direction: column; }
        }
    `],
})
export class VehicleModelListComponent implements OnInit {
    private readonly api = inject(VehicleModelsApiService);
    private readonly permissionService = inject(PermissionService);
    private readonly notify = inject(NotificationService);
    private readonly confirmService = inject(ConfirmService);

    vehicleModels: VehicleModel[] = [];
    manufacturerOptions: Array<{ label: string; value: string }> = [];
    totalRecords = 0;
    rows = 20;
    first = 0;
    loading = false;
    exporting = false;
    saving = false;
    showDialog = false;
    editingItem: VehicleModel | null = null;

    private lastLazyEvent: any = {
        first: 0,
        rows: 20,
        sortField: 'manufacturer',
        sortOrder: 1,
        filters: {},
    };

    form: VehicleModelForm = this.createEmptyForm();

    ngOnInit(): void {
        this.loadData();
        this.loadManufacturers();
    }

    loadData(event: any = this.lastLazyEvent): void {
        this.loading = true;
        this.lastLazyEvent = event;
        this.first = event.first ?? 0;
        this.rows = event.rows ?? 20;

        const page = Math.floor(this.first / this.rows) + 1;
        const params: Record<string, string | number> = {
            page,
            limit: this.rows,
            sortBy: event.sortField || 'manufacturer',
            sortOrder: (event.sortOrder || 1) === 1 ? 'ASC' : 'DESC',
            filters: JSON.stringify(event.filters ?? {}),
        };

        const global = event.filters?.global?.value;
        if (global) {
            params['search'] = global;
        }

        this.api.getAll(params).subscribe({
            next: (result) => {
                this.vehicleModels = result.items;
                this.totalRecords = result.total;
                this.loading = false;
            },
            error: (error) => {
                this.loading = false;
                this.notify.error(error);
            },
        });
    }

    onLazyLoad(event: any): void {
        this.loadData(event);
    }

    loadManufacturers(): void {
        this.api.getManufacturers().subscribe({
            next: (manufacturers) => {
                this.manufacturerOptions = manufacturers.map((name) => ({
                    label: name,
                    value: name,
                }));
            },
            error: (error) => {
                this.notify.error(error);
                this.manufacturerOptions = [];
            },
        });
    }

    openDialog(item?: VehicleModel): void {
        this.editingItem = item ?? null;
        this.form = item
            ? { manufacturer: item.manufacturer, model: item.model }
            : this.createEmptyForm();
        this.showDialog = true;
    }

    onDialogHide(): void {
        this.editingItem = null;
        this.form = this.createEmptyForm();
        this.saving = false;
    }

    isFormValid(): boolean {
        return !!this.form.manufacturer.trim() && !!this.form.model.trim();
    }

    save(): void {
        if (!this.isFormValid()) {
            return;
        }

        this.saving = true;
        const payload: VehicleModelPayload = {
            manufacturer: this.form.manufacturer.trim(),
            model: this.form.model.trim(),
        };

        const request$ = this.editingItem
            ? this.api.update(this.editingItem.id, payload)
            : this.api.create(payload);

        request$.subscribe({
            next: () => {
                this.showDialog = false;
                this.saving = false;
                this.notify.success('COMMON.SUCCESS');
                this.loadData();
            },
            error: (error) => {
                this.saving = false;
                this.notify.error(error);
            },
        });
    }

    async deleteItem(item: VehicleModel): Promise<void> {
        if (!await this.confirmService.confirm('VEHICLE_MODELS.DELETE_CONFIRM', { value: `${item.manufacturer} ${item.model}` })) {
            return;
        }

        this.api.delete(item.id).subscribe({
            next: () => {
                this.notify.success('COMMON.DELETE_SUCCESS');
                this.loadData();
            },
            error: (error) => this.notify.error(error),
        });
    }

    exportData(): void {
        this.exporting = true;
        const event = this.lastLazyEvent ?? {};
        const params: Record<string, string | number> = {
            sortBy: event.sortField || 'manufacturer',
            sortOrder: (event.sortOrder || 1) === 1 ? 'ASC' : 'DESC',
            filters: JSON.stringify(event.filters ?? {}),
        };

        const global = event.filters?.global?.value;
        if (global) {
            params['search'] = global;
        }

        this.api.export(params).subscribe({
            next: (blob) => {
                downloadBlob(blob, 'vehicle-models.xlsx');
                this.exporting = false;
            },
            error: (error) => {
                this.exporting = false;
                this.notify.error(error);
            },
        });
    }

    get canCreateVehicleModels(): boolean {
        return this.permissionService.hasPermission('vehicle-models.create');
    }

    get canUpdateVehicleModels(): boolean {
        return this.permissionService.hasPermission('vehicle-models.update');
    }

    get canDeleteVehicleModels(): boolean {
        return this.permissionService.hasPermission('vehicle-models.delete');
    }

    get canExportVehicleModels(): boolean {
        return this.permissionService.hasPermission('vehicle-models.export');
    }

    get hasActions(): boolean {
        return this.canUpdateVehicleModels || this.canDeleteVehicleModels;
    }

    private createEmptyForm(): VehicleModelForm {
        return {
            manufacturer: '',
            model: '',
        };
    }
}
