import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import {
    PermanentEscortsApiService,
    PermanentEscortDomain,
    PermanentEscortDomainUser,
    PermanentEscortItem,
} from '../services/permanent-escorts-api.service';

@Component({
    selector: 'app-permanent-escorts-management',
    standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule, TableModule, DropdownModule, DialogModule, HasPermissionDirective],
    template: `
        <div class="page-header">
            <div class="header-info">
                <h1>{{ 'PERMANENT_ESCORTS.TITLE' | translate }}</h1>
                <p class="header-description">{{ 'PERMANENT_ESCORTS.DESCRIPTION' | translate }}</p>
            </div>
            <div class="header-actions" *hasPermission="'settings.permanent-escorts.manage'">
                <button class="btn btn-primary" (click)="openAddDialog()">
                    <i class="pi pi-plus"></i> {{ 'PERMANENT_ESCORTS.ADD' | translate }}
                </button>
            </div>
        </div>

        <p-dialog
            [header]="'PERMANENT_ESCORTS.ADD' | translate"
            [(visible)]="showAddDialog"
            [modal]="true"
            [draggable]="false"
            [style]="{ width: '560px' }"
            *hasPermission="'settings.permanent-escorts.manage'"
        >
            @if (showAddDialog) {
                <div class="filter-grid">
                    <div class="field">
                        <label>{{ 'PERMANENT_ESCORTS.DOMAIN' | translate }} <span class="required">*</span></label>
                        <p-dropdown
                            [options]="domains"
                            optionLabel="name"
                            optionValue="id"
                            [(ngModel)]="selectedDomainId"
                            [placeholder]="'PERMANENT_ESCORTS.SELECT_DOMAIN' | translate"
                            appendTo="body"
                            (onChange)="onDomainChange()"
                            [showClear]="true"
                            [style]="{ width: '100%' }"
                        ></p-dropdown>
                    </div>
                    <div class="field">
                        <label>{{ 'PERMANENT_ESCORTS.USER' | translate }} <span class="required">*</span></label>
                        <p-dropdown
                            [options]="domainUsers"
                            optionLabel="fullName"
                            optionValue="id"
                            [(ngModel)]="selectedUserId"
                            [placeholder]="selectedDomainId ? ('PERMANENT_ESCORTS.SELECT_USER' | translate) : ('PERMANENT_ESCORTS.SELECT_DOMAIN_FIRST' | translate)"
                            [disabled]="!selectedDomainId || loadingUsers"
                            appendTo="body"
                            panelStyleClass="permanent-escorts-user-panel"
                            [filter]="true"
                            filterBy="fullName,username,email"
                            [style]="{ width: '100%' }"
                        >
                            <ng-template pTemplate="filter" let-options="options">
                                <div class="permanent-escorts-filter-template">
                                    <i class="pi pi-search" aria-hidden="true"></i>
                                    <input
                                        type="text"
                                        class="p-inputtext p-component"
                                        [placeholder]="'COMMON.SEARCH' | translate"
                                        (input)="options.filter($event)"
                                    />
                                </div>
                            </ng-template>
                        </p-dropdown>
                    </div>
                </div>
                @if (domainValidationError) {
                    <small class="field-error">{{ domainValidationError | translate }}</small>
                }
                @if (userValidationError) {
                    <small class="field-error">{{ userValidationError | translate }}</small>
                }
            }
            <ng-template pTemplate="footer">
                <button class="btn btn-secondary" (click)="closeAddDialog()">{{ 'COMMON.CANCEL' | translate }}</button>
                <button class="btn btn-primary" (click)="addEscort()" [disabled]="adding">
                    @if (adding) { <i class="pi pi-spin pi-spinner"></i> }
                    {{ 'PERMANENT_ESCORTS.ADD' | translate }}
                </button>
            </ng-template>
        </p-dialog>

        <div class="card table-card">
            <p-table
                [value]="escorts"
                [loading]="loading"
                [paginator]="true"
                [rows]="20"
                [rowsPerPageOptions]="[10, 20, 50]"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="{first}-{last} / {totalRecords}"
                styleClass="permanent-escorts-table p-datatable-sm p-datatable-striped p-datatable-gridlines"
                dataKey="userId"
            >
                <ng-template pTemplate="header">
                    <tr>
                        <th pSortableColumn="fullName">{{ 'PERMANENT_ESCORTS.FULL_NAME' | translate }} <p-sortIcon field="fullName" /></th>
                        <th pSortableColumn="username">{{ 'PERMANENT_ESCORTS.USERNAME' | translate }} <p-sortIcon field="username" /></th>
                        <th pSortableColumn="email">{{ 'PERMANENT_ESCORTS.EMAIL' | translate }} <p-sortIcon field="email" /></th>
                        <th pSortableColumn="isActive">{{ 'COMMON.STATUS' | translate }} <p-sortIcon field="isActive" /></th>
                        <th pSortableColumn="domain.name">{{ 'PERMANENT_ESCORTS.DOMAIN' | translate }} <p-sortIcon field="domain.name" /></th>
                        <th pSortableColumn="createdAt">{{ 'COMMON.CREATED_AT' | translate }} <p-sortIcon field="createdAt" /></th>
                        <th pSortableColumn="updatedAt">{{ 'COMMON.UPDATED_AT' | translate }} <p-sortIcon field="updatedAt" /></th>
                        <th style="width: 100px">{{ 'COMMON.ACTIONS' | translate }}</th>
                    </tr>
                </ng-template>
                <ng-template pTemplate="body" let-escort>
                    <tr>
                        <td>{{ escort.fullName }}</td>
                        <td>{{ escort.username }}</td>
                        <td>{{ escort.email || '-' }}</td>
                        <td>
                            <span class="status-badge" [class.active]="escort.isActive" [class.inactive]="!escort.isActive">
                                {{ (escort.isActive ? 'COMMON.ACTIVE' : 'COMMON.INACTIVE') | translate }}
                            </span>
                        </td>
                        <td>{{ escort.domain?.name || '-' }}</td>
                        <td>{{ escort.createdAt | date:'short' }}</td>
                        <td>{{ escort.updatedAt | date:'short' }}</td>
                        <td class="actions">
                            <button
                                class="btn-icon danger"
                                *hasPermission="'settings.permanent-escorts.manage'"
                                (click)="removeEscort(escort)"
                                [title]="'COMMON.DELETE' | translate"
                            >
                                <i class="pi pi-trash"></i>
                            </button>
                        </td>
                    </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                    <tr>
                        <td colspan="8" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td>
                    </tr>
                </ng-template>
            </p-table>
        </div>
    `,
    styles: [`
        :host { display: block; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .header-info h1 { margin: 0; font-size: 1.5rem; }
        .header-description { color: var(--color-text-secondary, #5c5a78); margin: 0.25rem 0 0; font-size: 0.9rem; }
        .filters-card { margin-bottom: 1rem; }
        .filter-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .field label { font-weight: 500; font-size: 0.9rem; }
        .required { color: var(--color-danger, #e74c3c); }
        .field-error { display: block; margin-top: 0.5rem; color: var(--color-danger, #e74c3c); }
        .table-card { margin-top: 1.5rem !important; padding: 0.5rem !important; overflow-x: auto; overflow-y: hidden; }
        :host ::ng-deep .permanent-escorts-table .p-datatable-thead > tr > th:first-child,
        :host ::ng-deep .permanent-escorts-table .p-datatable-tbody > tr > td:first-child,
        :host ::ng-deep .permanent-escorts-table .p-datatable-tfoot > tr > td:first-child {
            border-inline-start: 1px solid var(--color-border, #e4e2f0) !important;
        }
        :host ::ng-deep .permanent-escorts-table .p-datatable-thead > tr > th:last-child,
        :host ::ng-deep .permanent-escorts-table .p-datatable-tbody > tr > td:last-child,
        :host ::ng-deep .permanent-escorts-table .p-datatable-tfoot > tr > td:last-child {
            border-inline-end: 1px solid var(--color-border, #e4e2f0) !important;
        }
        :host ::ng-deep .p-dialog .p-dropdown { width: 100%; }
        ::ng-deep .permanent-escorts-user-panel { z-index: 1205 !important; }
        ::ng-deep .permanent-escorts-user-panel .p-dropdown-items .p-dropdown-item { text-align: right; }
        ::ng-deep .permanent-escorts-user-panel .p-dropdown-header {
            padding: 0.5rem;
            overflow: hidden;
            box-sizing: border-box;
        }
        ::ng-deep .permanent-escorts-user-panel .p-dropdown-filter-container {
            width: 100%;
            max-width: 100%;
            position: relative;
            box-sizing: border-box;
            overflow: hidden;
        }
        ::ng-deep .permanent-escorts-user-panel .p-dropdown-filter {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            margin: 0 !important;
            display: block;
            height: 2.5rem;
            direction: rtl;
            text-align: right;
            padding-inline-start: 0.75rem;
            padding-inline-end: 2rem;
        }
        ::ng-deep .permanent-escorts-user-panel .p-dropdown-filter-icon {
            position: absolute !important;
            inset-inline-start: auto;
            inset-inline-end: 0.75rem;
            top: 50% !important;
            margin-top: calc(-0.5rem - 2px) !important;
            transform: none !important;
            width: 1rem;
            height: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            font-size: 0.95rem;
        }
        ::ng-deep .permanent-escorts-user-panel .p-dropdown-filter-icon::before {
            display: block;
            line-height: 1;
            transform: none;
        }
        ::ng-deep .permanent-escorts-user-panel .p-dropdown-filter-icon svg,
        ::ng-deep .permanent-escorts-user-panel .p-dropdown-filter-icon .pi {
            line-height: 1;
        }
        .permanent-escorts-filter-template {
            position: relative;
            width: 100%;
        }
        .permanent-escorts-filter-template i {
            position: absolute;
            left: 0.75rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--color-text-muted, #9896ad);
            line-height: 1;
            pointer-events: none;
            font-size: 0.9rem;
        }
        .permanent-escorts-filter-template input {
            width: 100%;
            height: 2.5rem;
            box-sizing: border-box;
            padding-inline-start: 2rem;
            padding-inline-end: 0.75rem;
            text-align: right;
        }
        .status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.8rem; font-weight: 500; }
        .status-badge.active { background: #e8f5e9; color: #2e7d32; }
        .status-badge.inactive { background: #fce4ec; color: #c62828; }
        .actions { display: flex; gap: 0.3rem; align-items: center; }
    `],
})
export class PermanentEscortsManagementComponent implements OnInit {
    private readonly api = inject(PermanentEscortsApiService);
    private readonly notify = inject(NotificationService);
    private readonly confirmService = inject(ConfirmService);

    escorts: PermanentEscortItem[] = [];
    domains: PermanentEscortDomain[] = [];
    domainUsers: Array<PermanentEscortDomainUser & { fullName: string }> = [];

    selectedDomainId: string | null = null;
    selectedUserId: string | null = null;
    showAddDialog = false;

    loading = false;
    loadingUsers = false;
    adding = false;

    domainValidationError = '';
    userValidationError = '';

    ngOnInit(): void {
        this.loadEscorts();
        this.loadDomains();
    }

    loadEscorts(): void {
        this.loading = true;
        this.api.getAll().subscribe({
            next: (items) => {
                this.escorts = items;
                if (this.showAddDialog && this.selectedDomainId) {
                    this.onDomainChange();
                }
                this.loading = false;
            },
            error: (err) => {
                this.loading = false;
                this.notify.error(err);
            },
        });
    }

    loadDomains(): void {
        this.api.getDomains().subscribe({
            next: (items) => {
                this.domains = items;
            },
            error: (err) => {
                this.notify.error(err);
            },
        });
    }

    openAddDialog(): void {
        this.showAddDialog = true;
        this.domainValidationError = '';
        this.userValidationError = '';
        this.selectedDomainId = null;
        this.selectedUserId = null;
        this.domainUsers = [];
    }

    closeAddDialog(): void {
        this.showAddDialog = false;
        this.domainValidationError = '';
        this.userValidationError = '';
    }

    onDomainChange(): void {
        this.domainValidationError = '';
        this.userValidationError = '';
        this.selectedUserId = null;
        this.domainUsers = [];

        if (!this.selectedDomainId) {
            return;
        }

        this.loadingUsers = true;
        this.api.getUsersByDomain(this.selectedDomainId).subscribe({
            next: (users) => {
                const existingEscortUserIds = new Set(this.escorts.map((escort) => escort.userId));
                this.domainUsers = users
                    .filter((user) => !existingEscortUserIds.has(user.id))
                    .map((user) => ({
                        ...user,
                        fullName: `${user.firstName} ${user.lastName}`.trim(),
                    }));
                this.loadingUsers = false;
            },
            error: (err) => {
                this.loadingUsers = false;
                this.notify.error(err);
            },
        });
    }

    addEscort(): void {
        this.domainValidationError = '';
        this.userValidationError = '';

        if (!this.selectedDomainId) {
            this.domainValidationError = 'PERMANENT_ESCORTS.VALIDATION_DOMAIN_REQUIRED';
            return;
        }

        if (!this.selectedUserId) {
            this.userValidationError = 'PERMANENT_ESCORTS.VALIDATION_USER_REQUIRED';
            return;
        }

        this.adding = true;
        this.api.add(this.selectedDomainId, this.selectedUserId).subscribe({
            next: () => {
                this.adding = false;
                this.notify.success('PERMANENT_ESCORTS.ADDED_SUCCESS');
                this.selectedUserId = null;
                this.closeAddDialog();
                this.loadEscorts();
            },
            error: (err) => {
                this.adding = false;
                this.notify.error(err);
            },
        });
    }

    async removeEscort(escort: PermanentEscortItem): Promise<void> {
        const confirmed = await this.confirmService.confirm('PERMANENT_ESCORTS.CONFIRM_REMOVE', {
            name: escort.fullName,
        });

        if (!confirmed) {
            return;
        }

        this.api.remove(escort.userId).subscribe({
            next: () => {
                this.notify.success('PERMANENT_ESCORTS.REMOVED_SUCCESS');
                this.loadEscorts();
            },
            error: (err) => {
                this.notify.error(err);
            },
        });
    }
}
