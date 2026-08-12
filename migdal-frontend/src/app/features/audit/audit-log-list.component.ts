import { Component, OnInit, ViewChild, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TableModule, Table, TableLazyLoadEvent } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { AuditApiService } from './services/audit-api.service';
import { AuditLog } from '../../core/models/entities.model';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { downloadBlob } from '@core/utils/download.util';

@Component({
  selector: 'app-audit-log-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    TableModule,
    InputTextModule,
    DropdownModule,
    CalendarModule,
    DialogModule,
    HasPermissionDirective,
  ],
  template: `
    <div class="page-header">
      <h1>{{ 'AUDIT.TITLE' | translate }}</h1>
      <button class="btn btn-secondary" *hasPermission="'audit.read'" (click)="exportData()">
        <i class="pi pi-file-excel"></i> {{ 'COMMON.EXPORT' | translate }}
      </button>
    </div>
    <div class="card table-card">
      <p-table
        #dt
        [value]="items"
        [lazy]="true"
        (onLazyLoad)="onLazyLoad($event)"
        [loading]="loading"
        [totalRecords]="totalRecords"
        [paginator]="true"
        [rows]="rows"
        [first]="first"
        [showCurrentPageReport]="true"
        [rowsPerPageOptions]="[10, 25, 50]"
        dataKey="id"
        styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
        currentPageReportTemplate="{first}-{last} / {totalRecords}"
        paginatorDropdownAppendTo="body"
        sortField="createdAt"
        [sortOrder]="-1"
      >
        <ng-template pTemplate="caption">
          <div class="table-header">
            <span class="p-input-icon-left">
              <i class="pi pi-search"></i>
              <input pInputText type="text"
                     [(ngModel)]="searchText"
                     [placeholder]="'COMMON.SEARCH' | translate"
                     (keyup.enter)="applyFilters()" />
            </span>
            <p-dropdown [options]="moduleOptions"
                        [(ngModel)]="selectedModule"
                        [placeholder]="'AUDIT.MODULE' | translate"
                        [showClear]="true"
                        (onChange)="applyFilters()"
                        appendTo="body">
            </p-dropdown>
            <p-dropdown [options]="actionOptions"
                        [(ngModel)]="selectedAction"
                        [placeholder]="'AUDIT.ACTION' | translate"
                        [showClear]="true"
                        (onChange)="applyFilters()"
                        appendTo="body">
            </p-dropdown>
            <p-calendar [(ngModel)]="dateFrom"
                        [placeholder]="'AUDIT.DATE_FROM' | translate"
                        [showIcon]="true"
                        [showClear]="true"
                        dateFormat="dd/mm/yy"
                        (onSelect)="applyFilters()"
                        (onClear)="applyFilters()"
                        appendTo="body">
            </p-calendar>
            <p-calendar [(ngModel)]="dateTo"
                        [placeholder]="'AUDIT.DATE_TO' | translate"
                        [showIcon]="true"
                        [showClear]="true"
                        dateFormat="dd/mm/yy"
                        (onSelect)="applyFilters()"
                        (onClear)="applyFilters()"
                        appendTo="body">
            </p-calendar>
            <button class="btn btn-secondary btn-sm" (click)="clearFilters()" [title]="'AUDIT.CLEAR_FILTERS' | translate">
              <i class="pi pi-filter-slash"></i> {{ 'AUDIT.CLEAR_FILTERS' | translate }}
            </button>
          </div>
        </ng-template>
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="createdAt">{{ 'AUDIT.TIMESTAMP' | translate }} <p-sortIcon field="createdAt" /></th>
            <th>{{ 'AUDIT.USER' | translate }}</th>
            <th pSortableColumn="module">{{ 'AUDIT.MODULE' | translate }} <p-sortIcon field="module" /></th>
            <th pSortableColumn="action">{{ 'AUDIT.ACTION' | translate }} <p-sortIcon field="action" /></th>
            <th pSortableColumn="entity">{{ 'AUDIT.ENTITY' | translate }} <p-sortIcon field="entity" /></th>
            <th>{{ 'AUDIT.DESCRIPTION_COL' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-log>
          <tr>
            <td dir="ltr" class="timestamp-cell">{{ log.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}</td>
            <td>
              @if (log.user) {
                <span class="user-name">{{ log.user.firstName }} {{ log.user.lastName }}</span>
              } @else {
                <span class="text-muted">{{ 'AUDIT.SYSTEM' | translate }}</span>
              }
            </td>
            <td>
              @if (log.module) {
                <span class="module-badge" [attr.data-module]="log.module">{{ 'AUDIT.MODULES.' + log.module | translate }}</span>
              }
            </td>
            <td>
              <span class="action-badge" [attr.data-action]="log.action">{{ 'AUDIT.ACTIONS.' + log.action.toUpperCase() | translate }}</span>
            </td>
            <td class="name-cell">{{ log.entity }}</td>
            <td class="description-cell">{{ log.description || '-' }}</td>
            <td class="actions">
              <button class="btn-icon" (click)="showDetails(log)" [title]="'AUDIT.VIEW_DETAILS' | translate">
                <i class="pi pi-eye"></i>
              </button>
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr><td colspan="7" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Detail Dialog -->
    <p-dialog [(visible)]="detailVisible"
              [header]="'AUDIT.DETAIL_TITLE' | translate"
              [modal]="true"
              [style]="{width: '700px', maxHeight: '85vh'}"
              [draggable]="false">
      @if (selectedLog) {
        <div class="detail-grid">
          <div class="detail-row">
            <span class="detail-label">{{ 'AUDIT.TIMESTAMP' | translate }}</span>
            <span dir="ltr">{{ selectedLog.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">{{ 'AUDIT.USER' | translate }}</span>
            @if (selectedLog.user) {
              <span>{{ selectedLog.user.firstName }} {{ selectedLog.user.lastName }} ({{ selectedLog.user.username }})</span>
            } @else {
              <span class="text-muted">{{ 'AUDIT.SYSTEM' | translate }}</span>
            }
          </div>
          @if (selectedLog.performedByEmail) {
            <div class="detail-row">
              <span class="detail-label">{{ 'AUDIT.EMAIL' | translate }}</span>
              <span>{{ selectedLog.performedByEmail }}</span>
            </div>
          }
          <div class="detail-row">
            <span class="detail-label">{{ 'AUDIT.MODULE' | translate }}</span>
            <span>
              @if (selectedLog.module) {
                <span class="module-badge" [attr.data-module]="selectedLog.module">{{ 'AUDIT.MODULES.' + selectedLog.module | translate }}</span>
              } @else { - }
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">{{ 'AUDIT.ACTION' | translate }}</span>
            <span class="action-badge" [attr.data-action]="selectedLog.action">{{ 'AUDIT.ACTIONS.' + selectedLog.action.toUpperCase() | translate }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">{{ 'AUDIT.ENTITY' | translate }}</span>
            <span>{{ selectedLog.entity }}</span>
          </div>
          @if (selectedLog.entityId) {
            <div class="detail-row">
              <span class="detail-label">{{ 'AUDIT.ENTITY_ID' | translate }}</span>
              <span class="mono">{{ selectedLog.entityId }}</span>
            </div>
          }
          @if (selectedLog.description) {
            <div class="detail-row">
              <span class="detail-label">{{ 'AUDIT.DESCRIPTION_COL' | translate }}</span>
              <span>{{ selectedLog.description }}</span>
            </div>
          }
          @if (selectedLog.ipAddress) {
            <div class="detail-row">
              <span class="detail-label">{{ 'AUDIT.IP_ADDRESS' | translate }}</span>
              <span class="mono">{{ selectedLog.ipAddress }}</span>
            </div>
          }
          @if (selectedLog.userAgent) {
            <div class="detail-row">
              <span class="detail-label">{{ 'AUDIT.USER_AGENT' | translate }}</span>
              <span class="ua-text">{{ selectedLog.userAgent }}</span>
            </div>
          }
          @if (selectedLog.oldValue) {
            <div class="detail-section">
              <h4><i class="pi pi-replay"></i> {{ 'AUDIT.OLD_VALUE' | translate }}</h4>
              <pre class="json-block">{{ formatJson(selectedLog.oldValue) }}</pre>
            </div>
          }
          @if (selectedLog.newValue) {
            <div class="detail-section">
              <h4><i class="pi pi-arrow-right"></i> {{ 'AUDIT.NEW_VALUE' | translate }}</h4>
              <pre class="json-block">{{ formatJson(selectedLog.newValue) }}</pre>
            </div>
          }
          @if (selectedLog.metadata) {
            <div class="detail-section">
              <h4><i class="pi pi-info-circle"></i> {{ 'AUDIT.METADATA' | translate }}</h4>
              <pre class="json-block">{{ formatJson(selectedLog.metadata) }}</pre>
            </div>
          }
        </div>
      }
    </p-dialog>
  `,
  styles: [`
    :host { display: block; }

    /* ── Filter bar inside table caption ── */
    .table-header {
      display: flex;
      align-items: stretch;
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .p-input-icon-left { position: relative; }
    .p-input-icon-left i { position: absolute; top: 50%; transform: translateY(-50%); inset-inline-start: 0.65rem; color: var(--color-text-muted, #9896ad); font-size: 0.78rem; }
    .p-input-icon-left input { padding-inline-start: 2rem; height: 100%; }
    :host ::ng-deep .table-header .p-dropdown,
    :host ::ng-deep .table-header .p-calendar {
      min-width: 160px;
      height: 100%;
    }
    :host ::ng-deep .table-header .p-dropdown .p-dropdown-trigger {
      width: 2rem;
    }
    :host ::ng-deep .table-header .p-dropdown .p-dropdown-trigger,
    :host ::ng-deep .table-header .p-dropdown .p-dropdown-label {
      height: 100%;
      display: flex;
      align-items: center;
    }
    :host ::ng-deep .table-header .p-dropdown .p-dropdown-label,
    :host ::ng-deep .table-header .p-inputtext {
      font-size: 0.8rem;
      padding: 0.34rem 0.55rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    :host ::ng-deep .table-header .p-calendar .p-inputtext {
      padding: 0.34rem 0.55rem;
    }
    :host ::ng-deep .table-header .p-datepicker-trigger {
      width: 2rem;
      padding: 0;
    }
    .btn-sm { padding: 0.3rem 0.55rem; font-size: 0.78rem; }

    /* ── Custom inline badges (matching project's status-badge / role-chip pattern) ── */
    .module-badge,
    .action-badge {
      display: inline-block;
      padding: 0.15rem 0.55rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: capitalize;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    /* Module colors */
    .module-badge { background: var(--color-primary-wash, #eeedf8); color: var(--color-text-secondary, #5c5a78); }
    .module-badge[data-module='auth'] { background: #e3f2fd; color: #1565c0; }
    .module-badge[data-module='users'] { background: #e8f5e9; color: #2e7d32; }
    .module-badge[data-module='roles'] { background: #fff8e1; color: #f57f17; }
    .module-badge[data-module='visitors'] { background: #e0f7fa; color: #00838f; }
    .module-badge[data-module='settings'] { background: #f3e5f5; color: #7b1fa2; }
    .module-badge[data-module='access-control'] { background: #fce4ec; color: #c62828; }

    /* Action colors */
    .action-badge { background: var(--color-primary-wash, #eeedf8); color: var(--color-text-secondary, #5c5a78); }
    .action-badge[data-action='CREATE'] { background: #e8f5e9; color: #2e7d32; }
    .action-badge[data-action='UPDATE'] { background: #fff8e1; color: #f57f17; }
    .action-badge[data-action='DELETE'] { background: #ffebee; color: #c62828; }
    .action-badge[data-action='LOGIN'] { background: #e3f2fd; color: #1565c0; }
    .action-badge[data-action='LOGOUT'] { background: var(--color-primary-wash, #eeedf8); color: var(--color-text-muted, #9896ad); }

    .user-name { font-weight: 500; }
    .text-muted { color: var(--color-text-muted, #9896ad); font-style: italic; font-size: 0.85rem; }
    .timestamp-cell { font-variant-numeric: tabular-nums; font-size: 0.85rem; white-space: nowrap; }
    .description-cell { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* ── Detail dialog ── */
    .detail-grid {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .detail-row {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      padding: 0.4rem 0;
      border-bottom: 1px solid var(--color-border-light, #f0eff5);
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label {
      font-weight: 600;
      min-width: 130px;
      color: var(--color-text-secondary, #5c5a78);
      font-size: 0.85rem;
      flex-shrink: 0;
    }
    .mono {
      font-family: 'Courier New', monospace;
      font-size: 0.82rem;
      color: var(--color-text-muted, #9896ad);
    }
    .ua-text {
      font-size: 0.78rem;
      word-break: break-all;
      color: var(--color-text-muted, #9896ad);
    }
    .detail-section {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 2px solid var(--color-border, #e4e2f0);
    }
    .detail-section h4 {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0 0 0.5rem;
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--color-primary, #020140);
    }
    .detail-section h4 i {
      font-size: 0.85rem;
      color: var(--color-accent, #6c63ff);
    }
    .json-block {
      background: var(--color-surface-alt, #f8f7fc);
      border: 1px solid var(--color-border, #e4e2f0);
      border-radius: var(--radius-sm, 6px);
      padding: 0.75rem;
      font-size: 0.78rem;
      max-height: 200px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
      color: var(--color-text, #1a1a2e);
    }
  `],
})
export class AuditLogListComponent implements OnInit {
  @ViewChild('dt') table!: Table;

  items: AuditLog[] = [];
  totalRecords = 0;
  loading = false;
  rows = 25;
  first = 0;

  searchText = '';
  selectedModule: string | null = null;
  selectedAction: string | null = null;
  dateFrom: Date | null = null;
  dateTo: Date | null = null;

  detailVisible = false;
  selectedLog: AuditLog | null = null;

  private lastEvent: TableLazyLoadEvent = {};

  moduleOptions: { label: string; value: string }[] = [];
  actionOptions: { label: string; value: string }[] = [];

  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  constructor(private auditApi: AuditApiService) { }

  ngOnInit(): void {
    this.buildDropdownOptions();
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.buildDropdownOptions());
  }

  private buildDropdownOptions(): void {
    const modules = ['auth', 'users', 'roles', 'visitors', 'settings', 'access-control', 'workstations', 'visits', 'notifications'];
    this.moduleOptions = modules.map(m => ({
      label: this.translate.instant('AUDIT.MODULES.' + m),
      value: m,
    }));

    const actions = [
      'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'KERBEROS_LOGIN',
      'IMPORT', 'ASSIGN_ROLES', 'ASSIGN_USERS', 'LINK_EXTERNAL_AUTH',
      'AUTO_PROVISION', 'CARDHOLDER_CREATE', 'CARDHOLDER_UPDATE',
      'CARDHOLDER_DELETE', 'CARDHOLDER_BATCH_CREATE', 'CARDHOLDER_BATCH_DELETE',
      'ADD_VISITORS', 'UPDATE_VISITOR', 'REMOVE_VISITOR',
      'ADD_ESCORTS', 'UPDATE_ESCORT', 'REMOVE_ESCORT',
      'STATUS_CHANGE', 'AUTO_CHECKOUT',
      'GENERATE_CHECK_IN_CODES', 'RESEND_CHECK_IN_CODE', 'REGENERATE_CHECK_IN_CODE',
      'KIOSK_CHECK_IN', 'CREATE_ENROLLMENT_TOKEN', 'BULK_UPSERT',
      'EMAIL_SENT', 'EMAIL_SEND_ERROR', 'SMS_SENT', 'SMS_SEND_ERROR',
      'RETENTION_CLEANUP',
      'PARKING_REQUEST_APPROVED', 'PARKING_REQUEST_DENIED',
    ];
    this.actionOptions = actions.map(a => ({
      label: this.translate.instant('AUDIT.ACTIONS.' + a),
      value: a,
    }));
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.lastEvent = event;
    this.loadData(event);
  }

  applyFilters(): void {
    this.first = 0;
    if (this.table) {
      this.table.first = 0;
    }
    this.loadData({ ...this.lastEvent, first: 0 });
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedModule = null;
    this.selectedAction = null;
    this.dateFrom = null;
    this.dateTo = null;
    this.applyFilters();
  }

  exportData(): void {
    const event = this.lastEvent ?? {};
    const params: Record<string, string | number> = {};

    const sortField = event.sortField as string;
    if (sortField) {
      params['sortBy'] = sortField;
      params['sortOrder'] = (event.sortOrder || -1) === 1 ? 'ASC' : 'DESC';
    }
    if (this.searchText) params['search'] = this.searchText;
    if (this.selectedModule) params['module'] = this.selectedModule;
    if (this.selectedAction) params['action'] = this.selectedAction;
    if (this.dateFrom) {
      const d = this.dateFrom;
      params['dateFrom'] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (this.dateTo) {
      const d = this.dateTo;
      params['dateTo'] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    this.auditApi.download(params).subscribe((blob) => {
      downloadBlob(blob, 'audit-logs.xlsx');
    });
  }

  showDetails(log: AuditLog): void {
    this.selectedLog = log;
    this.detailVisible = true;
  }

  formatJson(raw: string | null): string {
    if (!raw) return '';
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  private loadData(event: TableLazyLoadEvent): void {
    this.loading = true;

    const page = Math.floor((event.first ?? 0) / (event.rows ?? this.rows)) + 1;
    const limit = event.rows ?? this.rows;

    const sortField = event.sortField as string;
    const sortOrder = event.sortOrder === 1 ? 'ASC' : 'DESC';

    const params: Record<string, string | number> = {
      page,
      limit,
    };

    if (sortField) {
      params['sortBy'] = sortField;
      params['sortOrder'] = sortOrder;
    }
    if (this.searchText) {
      params['search'] = this.searchText;
    }
    if (this.selectedModule) {
      params['module'] = this.selectedModule;
    }
    if (this.selectedAction) {
      params['action'] = this.selectedAction;
    }
    if (this.dateFrom) {
      const d = this.dateFrom;
      params['dateFrom'] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (this.dateTo) {
      const d = this.dateTo;
      params['dateTo'] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    this.auditApi.findAll(params).subscribe({
      next: (result) => {
        this.items = result.items;
        this.totalRecords = result.total;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
