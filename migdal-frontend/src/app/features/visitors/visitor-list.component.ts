import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { PermissionService } from '@core/permissions/permission.service';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { downloadBlob } from '@core/utils/download.util';
import { buildVehicleTypeOptions, getVehicleTypeLabel } from '@core/utils/vehicle-type.util';
import { Visitor } from '@core/models/entities.model';
import { VisitorsApiService, VisitorPayload } from './services/visitors-api.service';

interface VisitorFormModel {
    personId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    hasVehicle: boolean;
    carNumber: string;
    vehicleType: string;
}

@Component({
    selector: 'app-visitor-list',
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
                <h1>{{ 'VISITORS.PAGE_TITLE' | translate }}</h1>
                <p class="page-description">{{ 'VISITORS.PAGE_DESCRIPTION' | translate }}</p>
            </div>
            <div class="header-actions">
                <button class="btn btn-outline" *ngIf="canExportVisitors" (click)="exportData()" [disabled]="exporting">
                    <i class="pi" [class.pi-file-excel]="!exporting" [class.pi-spinner]="exporting" [class.pi-spin]="exporting"></i>
                    {{ 'COMMON.EXPORT' | translate }}
                </button>
                <button class="btn btn-primary" *ngIf="canCreateVisitors" (click)="openDialog()">
                    <i class="pi pi-plus"></i> {{ 'VISITORS.ADD_VISITOR' | translate }}
                </button>
            </div>
        </div>

        <div class="card table-card">
            <p-table
                #dt
                [value]="visitors"
                [lazy]="true"
                (onLazyLoad)="onLazyLoad($event)"
                [loading]="loading"
                [totalRecords]="totalRecords"
                [paginator]="true"
                [rows]="rows"
                [first]="first"
                [showCurrentPageReport]="true"
                [rowsPerPageOptions]="[10, 20, 50]"
                [globalFilterFields]="['personId', 'firstName', 'lastName', 'phone', 'carNumber', 'vehicleType', 'buildingName', 'hostName']"
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
                        <th>{{ 'VISITORS.VISITOR_NAME' | translate }}</th>
                        <th pSortableColumn="personId">{{ 'VISITORS.PERSON_ID' | translate }} <p-sortIcon field="personId" /> <p-columnFilter field="personId" type="text" display="menu"></p-columnFilter></th>
                        <th pSortableColumn="phone">{{ 'VISITORS.PHONE' | translate }} <p-sortIcon field="phone" /> <p-columnFilter field="phone" type="text" display="menu"></p-columnFilter></th>
                        <th pSortableColumn="vehicleType">{{ 'VISITORS.VEHICLE_TYPE' | translate }} <p-sortIcon field="vehicleType" /> <p-columnFilter field="vehicleType" type="text" display="menu"></p-columnFilter></th>
                        <th pSortableColumn="carNumber">{{ 'VISITORS.CAR_NUMBER' | translate }} <p-sortIcon field="carNumber" /> <p-columnFilter field="carNumber" type="text" display="menu"></p-columnFilter></th>
                        <th>{{ 'VISITORS.BUILDING' | translate }}</th>
                        <th>{{ 'VISITORS.FLOOR' | translate }}</th>
                        <th>{{ 'VISITORS.HOST_NAME' | translate }}</th>
                        <th *ngIf="hasVisitorsActions">{{ 'COMMON.ACTIONS' | translate }}</th>
                    </tr>
                </ng-template>
                <ng-template pTemplate="body" let-visitor>
                    <tr>
                        <td>{{ getVisitorName(visitor) }}</td>
                        <td class="mono-cell">{{ visitor.personId }}</td>
                        <td>{{ visitor.phone || '-' }}</td>
                        <td>{{ getVehicleTypeLabel(visitor.vehicleType) }}</td>
                        <td>{{ visitor.carNumber || '-' }}</td>
                        <td>{{ visitor.buildingName || '-' }}</td>
                        <td>{{ visitor.floor ?? '-' }}</td>
                        <td>{{ visitor.hostName || '-' }}</td>
                        <td class="actions-cell" *ngIf="hasVisitorsActions">
                            <button class="btn-icon" *ngIf="canUpdateVisitors" (click)="openDialog(visitor)" [title]="'COMMON.EDIT' | translate">
                                <i class="pi pi-pencil"></i>
                            </button>
                            <button class="btn-icon danger" *ngIf="canDeleteVisitors" (click)="deleteVisitor(visitor)" [title]="'COMMON.DELETE' | translate">
                                <i class="pi pi-trash"></i>
                            </button>
                        </td>
                    </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                    <tr>
                        <td [attr.colspan]="hasVisitorsActions ? 9 : 8" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog [header]="editingVisitor ? ('VISITORS.EDIT_VISITOR' | translate) : ('VISITORS.ADD_VISITOR' | translate)"
            [(visible)]="showDialog" (onHide)="onDialogHide()" [modal]="true" [style]="{ width: '640px' }" [draggable]="false">
            @if (showDialog) {
                <div class="dialog-form">
                    <div class="form-grid">
                        <div class="field">
                            <label>{{ 'VISITORS.PERSON_ID' | translate }} <span class="required">*</span></label>
                            <input type="text" [(ngModel)]="form.personId" [placeholder]="'VISITORS.PERSON_ID' | translate" />
                        </div>
                        <div class="field">
                            <label>{{ 'VISITORS.PHONE' | translate }} <span class="required">*</span></label>
                            <input type="text" [(ngModel)]="form.phone" [placeholder]="'VISITORS.PHONE' | translate" />
                        </div>
                        <div class="field">
                            <label>{{ 'VISITORS.FIRST_NAME' | translate }} <span class="required">*</span></label>
                            <input type="text" [(ngModel)]="form.firstName" [placeholder]="'VISITORS.FIRST_NAME' | translate" />
                        </div>
                        <div class="field">
                            <label>{{ 'VISITORS.LAST_NAME' | translate }} <span class="required">*</span></label>
                            <input type="text" [(ngModel)]="form.lastName" [placeholder]="'VISITORS.LAST_NAME' | translate" />
                        </div>
                        <div class="field field-full">
                            <label>{{ 'VISITORS.EMAIL' | translate }}</label>
                            <input type="email" [(ngModel)]="form.email" [placeholder]="'VISITORS.EMAIL' | translate" />
                        </div>
                    </div>

                    <label class="checkbox-field">
                        <input type="checkbox" [(ngModel)]="form.hasVehicle" (ngModelChange)="onHasVehicleChange()" />
                        <span>{{ 'VISITORS.HAS_VEHICLE' | translate }}</span>
                    </label>

                    @if (form.hasVehicle) {
                        <div class="form-grid vehicle-grid">
                            <div class="field">
                                <label>{{ 'VISITORS.CAR_NUMBER' | translate }} <span class="required">*</span></label>
                                <input type="text" [(ngModel)]="form.carNumber" [placeholder]="'VISITORS.CAR_NUMBER' | translate" />
                            </div>
                            <div class="field">
                                <label>{{ 'VISITORS.VEHICLE_TYPE' | translate }} <span class="required">*</span></label>
                                <p-dropdown
                                    [options]="vehicleTypeOptions"
                                    [(ngModel)]="form.vehicleType"
                                    optionLabel="label"
                                    optionValue="value"
                                    [placeholder]="'VISITORS.SELECT_VEHICLE_TYPE' | translate"
                                    appendTo="body"
                                    [style]="{ width: '100%' }">
                                </p-dropdown>
                            </div>
                        </div>
                    }
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
        .mono-cell { font-family: Consolas, 'Courier New', monospace; }
        .muted-cell { color: var(--color-text-secondary, #5c5a78); white-space: nowrap; }
        .actions-cell { display: flex; gap: 0.35rem; align-items: center; }
        .dialog-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
        .vehicle-grid { padding-top: 0.25rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .field-full { grid-column: 1 / -1; }
        .field label { font-weight: 500; font-size: 0.9rem; }
        .field input { width: 100%; padding: 0.55rem 0.75rem; border: 1.5px solid var(--color-border, #e4e2f0); border-radius: 6px; font: inherit; }
        .field input:focus { outline: none; border-color: var(--color-accent, #6c63ff); box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.12); }
        .checkbox-field { display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 500; }
        .required { color: var(--color-danger, #e53935); }
        .empty { text-align: center; padding: 1rem; }
        @media (max-width: 900px) {
            .page-header { flex-direction: column; }
            .form-grid { grid-template-columns: 1fr; }
            .field-full { grid-column: auto; }
        }
    `],
})
export class VisitorListComponent implements OnInit {
    private readonly visitorsApi = inject(VisitorsApiService);
    private readonly permissionService = inject(PermissionService);
    private readonly notify = inject(NotificationService);
    private readonly confirmService = inject(ConfirmService);
    private readonly translate = inject(TranslateService);
    private readonly destroyRef = inject(DestroyRef);

    visitors: Visitor[] = [];
    totalRecords = 0;
    rows = 20;
    first = 0;
    loading = false;
    exporting = false;
    saving = false;
    showDialog = false;
    editingVisitor: Visitor | null = null;
    vehicleTypeOptions = buildVehicleTypeOptions(this.translate);

    private lastLazyEvent: any = { first: 0, rows: 20, sortField: 'updatedAt', sortOrder: -1, filters: {} };

    form: VisitorFormModel = this.createEmptyForm();

    ngOnInit(): void {
        this.loadData();
        this.translate.onLangChange
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                this.vehicleTypeOptions = buildVehicleTypeOptions(this.translate);
            });
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
            sortBy: event.sortField || 'updatedAt',
            sortOrder: (event.sortOrder || -1) === 1 ? 'ASC' : 'DESC',
            filters: JSON.stringify(event.filters ?? {}),
        };
        const global = event.filters?.global?.value;
        if (global) {
            params['search'] = global;
        }

        this.visitorsApi.getAll(params).subscribe({
            next: (result) => {
                this.visitors = result.items;
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

    exportData(): void {
        this.exporting = true;
        const event = this.lastLazyEvent ?? {};
        const params: Record<string, string | number> = {
            sortBy: event.sortField || 'updatedAt',
            sortOrder: (event.sortOrder || -1) === 1 ? 'ASC' : 'DESC',
            filters: JSON.stringify(event.filters ?? {}),
        };
        const global = event.filters?.global?.value;
        if (global) {
            params['search'] = global;
        }

        this.visitorsApi.export(params).subscribe({
            next: (blob) => {
                downloadBlob(blob, 'visitors.xlsx');
                this.exporting = false;
            },
            error: (error) => {
                this.exporting = false;
                this.notify.error(error);
            },
        });
    }

    openDialog(visitor?: Visitor): void {
        this.editingVisitor = visitor ?? null;
        this.form = visitor
            ? {
                personId: visitor.personId ?? '',
                firstName: visitor.firstName ?? '',
                lastName: visitor.lastName ?? '',
                phone: visitor.phone ?? '',
                email: visitor.email ?? '',
                hasVehicle: !!visitor.carNumber,
                carNumber: visitor.carNumber ?? '',
                vehicleType: visitor.vehicleType ?? '',
            }
            : this.createEmptyForm();
        this.showDialog = true;
    }

    onDialogHide(): void {
        this.editingVisitor = null;
        this.form = this.createEmptyForm();
        this.saving = false;
    }

    onHasVehicleChange(): void {
        if (!this.form.hasVehicle) {
            this.form.carNumber = '';
            this.form.vehicleType = '';
        }
    }

    isFormValid(): boolean {
        if (!this.form.personId.trim() || !this.form.firstName.trim() || !this.form.lastName.trim() || !this.form.phone.trim()) {
            return false;
        }

        if (!this.form.hasVehicle) {
            return true;
        }

        return !!this.form.carNumber.trim() && !!this.form.vehicleType.trim();
    }

    save(): void {
        if (!this.isFormValid()) {
            return;
        }

        this.saving = true;
        const payload = this.buildPayload();
        const request$ = this.editingVisitor
            ? this.visitorsApi.update(this.editingVisitor.id, payload)
            : this.visitorsApi.create(payload);

        request$.subscribe({
            next: () => {
                this.showDialog = false;
                this.saving = false;
                this.notify.success(this.editingVisitor ? 'VISITORS.UPDATED_SUCCESS' : 'VISITORS.CREATED_SUCCESS');
                this.loadData();
            },
            error: (error) => {
                this.saving = false;
                this.notify.error(error);
            },
        });
    }

    async deleteVisitor(visitor: Visitor): Promise<void> {
        if (!await this.confirmService.confirm('VISITORS.DELETE_CONFIRM')) {
            return;
        }

        this.visitorsApi.delete(visitor.id).subscribe({
            next: () => {
                this.notify.success('VISITORS.DELETED_SUCCESS');
                this.loadData();
            },
            error: (error) => this.notify.error(error),
        });
    }

    getVehicleTypeLabel(vehicleType: string | null): string {
        return getVehicleTypeLabel(vehicleType, this.translate);
    }

    getVisitorName(visitor: Visitor): string {
        const fullName = `${visitor.firstName ?? ''} ${visitor.lastName ?? ''}`.trim();
        return fullName || '-';
    }

    get canCreateVisitors(): boolean {
        return this.permissionService.hasPermission('visitors.create');
    }

    get canExportVisitors(): boolean {
        return this.permissionService.hasPermission('visitors.export');
    }

    get canUpdateVisitors(): boolean {
        return this.permissionService.hasPermission('visitors.update');
    }

    get canDeleteVisitors(): boolean {
        return this.permissionService.hasPermission('visitors.delete');
    }

    get hasVisitorsActions(): boolean {
        return this.canUpdateVisitors || this.canDeleteVisitors;
    }

    private buildPayload(): VisitorPayload {
        const payload: VisitorPayload = {
            personId: this.form.personId.trim(),
            firstName: this.form.firstName.trim(),
            lastName: this.form.lastName.trim(),
            phone: this.form.phone.trim(),
        };

        if (this.form.email.trim()) {
            payload.email = this.form.email.trim();
        }

        if (this.form.hasVehicle) {
            payload.carNumber = this.form.carNumber.trim();
            payload.vehicleType = this.form.vehicleType.trim();
        }

        return payload;
    }

    private createEmptyForm(): VisitorFormModel {
        return {
            personId: '',
            firstName: '',
            lastName: '',
            phone: '',
            email: '',
            hasVehicle: false,
            carNumber: '',
            vehicleType: '',
        };
    }
}
