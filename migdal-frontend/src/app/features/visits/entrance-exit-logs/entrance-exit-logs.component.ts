import { Component, OnInit, ChangeDetectionStrategy, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { downloadBlob } from '@core/utils/download.util';
import {
  VisitsApiService,
  EntranceExitLog,
  EntranceExitLogQuery,
  EntranceExitLogResponse,
} from '../services/visits-api.service';

@Component({
  selector: 'app-entrance-exit-logs',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    TableModule,
    InputTextModule,
    CalendarModule,
    DropdownModule,
    HasPermissionDirective,
    DateFormatPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="header-text">
        <h1>{{ 'ENTRANCE_EXIT_LOGS.TITLE' | translate }}</h1>
        <p class="header-description">{{ 'ENTRANCE_EXIT_LOGS.DESCRIPTION' | translate }}</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" *hasPermission="'visits.read'" (click)="exportData()">
          <i class="pi pi-file-excel"></i> {{ 'COMMON.EXPORT' | translate }}
        </button>
      </div>
    </div>

    <!-- Filters + Table -->
    <div class="combined-card card">
      <div class="filters-section">
        <div class="filters-row">
        <div class="filter-group">
          <label>{{ 'ENTRANCE_EXIT_LOGS.DATE_FROM' | translate }}</label>
          <p-calendar [(ngModel)]="dateFrom" dateFormat="dd/mm/yy" [showIcon]="true" [showClear]="true"
            [readonlyInput]="true" appendTo="body" (onSelect)="onFilterChange()" (onClear)="onFilterChange()"
            [placeholder]="'ENTRANCE_EXIT_LOGS.DATE_FROM' | translate"></p-calendar>
        </div>
        <div class="filter-group">
          <label>{{ 'ENTRANCE_EXIT_LOGS.DATE_TO' | translate }}</label>
          <p-calendar [(ngModel)]="dateTo" dateFormat="dd/mm/yy" [showIcon]="true" [showClear]="true"
            [readonlyInput]="true" appendTo="body" (onSelect)="onFilterChange()" (onClear)="onFilterChange()"
            [placeholder]="'ENTRANCE_EXIT_LOGS.DATE_TO' | translate"></p-calendar>
        </div>
        <div class="filter-group">
          <label>{{ 'ENTRANCE_EXIT_LOGS.STATUS' | translate }}</label>
          <p-dropdown [options]="statusOptions" [(ngModel)]="selectedStatus" (onChange)="onFilterChange()"
            [placeholder]="'ENTRANCE_EXIT_LOGS.ALL_STATUSES' | translate" [showClear]="true"
            appendTo="body" styleClass="filter-dropdown"></p-dropdown>
        </div>
        <div class="filter-group search-group">
          <label>{{ 'COMMON.SEARCH' | translate }}</label>
          <span class="p-input-icon-left">
            <i class="pi pi-search"></i>
            <input pInputText type="text" [(ngModel)]="searchText" (input)="onSearchInput()"
              [placeholder]="'ENTRANCE_EXIT_LOGS.SEARCH_PLACEHOLDER' | translate" />
          </span>
        </div>
        </div>
      </div>

      <!-- Table -->
      <div class="table-section">
      @if (error) {
        <div class="error-state">
          <i class="pi pi-exclamation-triangle"></i>
          <p>{{ 'ENTRANCE_EXIT_LOGS.ERROR' | translate }}</p>
          <button class="btn btn-primary btn-sm" (click)="loadData()">{{ 'ENTRANCE_EXIT_LOGS.RETRY' | translate }}</button>
        </div>
      } @else {
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
          [rowsPerPageOptions]="[10, 20, 50, 100]"
          dataKey="visitVisitorId"
          styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
          currentPageReportTemplate="{first}-{last} / {totalRecords}"
          paginatorDropdownAppendTo="body"
        >
          <ng-template pTemplate="header">
            <tr>
              <th pSortableColumn="firstName">{{ 'ENTRANCE_EXIT_LOGS.FIRST_NAME' | translate }} <p-sortIcon field="firstName" /></th>
              <th pSortableColumn="lastName">{{ 'ENTRANCE_EXIT_LOGS.LAST_NAME' | translate }} <p-sortIcon field="lastName" /></th>
              <th pSortableColumn="personId">{{ 'ENTRANCE_EXIT_LOGS.PERSON_ID' | translate }} <p-sortIcon field="personId" /></th>
              <th>{{ 'ENTRANCE_EXIT_LOGS.PHONE' | translate }}</th>
              <th>{{ 'ENTRANCE_EXIT_LOGS.EMAIL' | translate }}</th>
              <th pSortableColumn="currentStatus">{{ 'ENTRANCE_EXIT_LOGS.STATUS' | translate }} <p-sortIcon field="currentStatus" /></th>
              <th pSortableColumn="arrivedAtUtc">{{ 'ENTRANCE_EXIT_LOGS.ARRIVED_AT' | translate }} <p-sortIcon field="arrivedAtUtc" /></th>
              <th pSortableColumn="checkedInAtUtc">{{ 'ENTRANCE_EXIT_LOGS.CHECKED_IN_AT' | translate }} <p-sortIcon field="checkedInAtUtc" /></th>
              <th pSortableColumn="checkedOutAtUtc">{{ 'ENTRANCE_EXIT_LOGS.CHECKED_OUT_AT' | translate }} <p-sortIcon field="checkedOutAtUtc" /></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-item>
            <tr>
              <td class="name-cell">{{ item.firstName }}</td>
              <td class="name-cell">{{ item.lastName }}</td>
              <td>{{ item.personId }}</td>
              <td>{{ item.phone ?? '-' }}</td>
              <td>{{ item.email ?? '-' }}</td>
              <td><span class="status-badge" [attr.data-status]="item.currentStatus">{{ statusLabel(item.currentStatus) }}</span></td>
              <td dir="ltr">{{ item.arrivedAtUtc | dateFormat }}</td>
              <td dir="ltr">{{ item.checkedInAtUtc | dateFormat }}</td>
              <td dir="ltr">{{ item.checkedOutAtUtc | dateFormat }}</td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr><td colspan="9" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
          </ng-template>
        </p-table>
      }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
    }
    .header-text h1 {
      margin: 0 0 0.25rem;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--color-text, #1e293b);
    }
    .header-description {
      margin: 0;
      color: var(--color-text-secondary, #64748b);
      font-size: 0.9rem;
    }
    .header-actions {
      display: flex; gap: 0.5rem; align-items: center;
    }

    /* Filters */
    .combined-card { padding: 0; overflow: hidden; }
    .filters-section {
      padding: 1rem 1.25rem;
    }
    .filters-row {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: flex-end;
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      min-width: 160px;
    }
    .filter-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--color-text-secondary, #64748b);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .search-group {
      flex: 1;
      min-width: 200px;
    }
    .p-input-icon-left { position: relative; width: 100%; display: flex; align-items: center; }
    .p-input-icon-left i { position: absolute; inset-inline-start: 0.75rem; color: var(--color-text-muted, #9896ad); }
    .p-input-icon-left input { padding-inline-start: 2.25rem; width: 100%; }

    /* Uniform height for all filter inputs */
    :host ::ng-deep .filter-group .p-calendar,
    :host ::ng-deep .filter-group .p-dropdown,
    .filter-group .p-input-icon-left input {
      height: 38px;
    }
    :host ::ng-deep .filter-group .p-calendar .p-inputtext,
    :host ::ng-deep .filter-group .p-dropdown .p-dropdown-label {
      height: 38px;
      display: flex;
      align-items: center;
    }
    :host ::ng-deep .filter-group .p-calendar .p-datepicker-trigger {
      height: 38px;
    }

    /* Table */
    .table-section { }
    .name-cell { font-weight: 500; }
    .empty {
      text-align: center;
      color: var(--color-text-muted);
      padding: 2rem !important;
      font-size: 0.88rem;
    }

    /* Status badges */
    .status-badge {
      display: inline-flex; align-items: center; gap: 0.3rem;
      padding: 0.28rem 0.7rem; border-radius: 999px;
      font-size: 0.78rem; font-weight: 600;
      white-space: nowrap; line-height: 1.4;
      background: var(--color-primary-wash, #eeedf8); color: var(--color-primary, #020140);
      border: 1px solid transparent;
    }
    .status-badge::before {
      content: ''; display: inline-block;
      width: 6px; height: 6px; border-radius: 50%;
      background: currentColor; opacity: 0.6;
      flex-shrink: 0;
    }
    .status-badge[data-status="1"] { background: rgba(245, 158, 11, 0.10); color: #b45309; border-color: rgba(245, 158, 11, 0.18); }
    .status-badge[data-status="2"] { background: rgba(34, 197, 94, 0.10); color: #15803d; border-color: rgba(34, 197, 94, 0.18); }
    .status-badge[data-status="3"] { background: rgba(100, 116, 139, 0.10); color: #475569; border-color: rgba(100, 116, 139, 0.18); }

    /* Error state */
    .error-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--color-text-secondary);
    }
    .error-state i { font-size: 2.5rem; color: var(--color-danger, #e53935); margin-bottom: 1rem; }
    .error-state p { margin: 0 0 1rem; }

    /* Buttons */
    .btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.5rem 1rem; border: none; border-radius: var(--radius-sm, 6px);
      cursor: pointer; font-weight: 600; font-size: 0.85rem;
      transition: all var(--transition-speed, 0.25s);
    }
    .btn-primary { background: var(--color-accent, #6c63ff); color: #fff; }
    .btn-primary:hover { background: var(--color-accent-hover, #5a52e0); }
    .btn-secondary { background: var(--color-primary-wash, #eeedf8); color: var(--color-text, #1e293b); }
    .btn-secondary:hover { background: var(--color-border, #e4e2f0); }
    .btn-sm { padding: 0.35rem 0.75rem; font-size: 0.8rem; }

    /* PrimeNG calendar overrides */
    :host ::ng-deep .filter-group .p-calendar .p-inputtext {
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      border: 1px solid var(--color-border, #e2e8f0);
      border-start-start-radius: var(--radius-sm, 6px);
      border-end-start-radius: var(--radius-sm, 6px);
      border-start-end-radius: 0;
      border-end-end-radius: 0;
    }
    :host ::ng-deep .filter-group .p-calendar .p-datepicker-trigger {
      border: 1px solid var(--color-border, #e2e8f0);
      border-inline-start: none;
      border-start-start-radius: 0;
      border-end-start-radius: 0;
      border-start-end-radius: var(--radius-sm, 6px);
      border-end-end-radius: var(--radius-sm, 6px);
    }
    :host ::ng-deep .p-dropdown.filter-dropdown {
      min-width: 160px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: flex-start; }
      .filters-row { flex-direction: column; }
      .filter-group { min-width: 100%; }
    }
  `],
})
export class EntranceExitLogsComponent implements OnInit {
  private visitsApi = inject(VisitsApiService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);

  items: EntranceExitLog[] = [];
  totalRecords = 0;
  rows = 20;
  first = 0;
  loading = false;
  error = false;

  // Filters
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  selectedStatus: string | null = null;
  searchText = '';

  statusOptions: { label: string; value: string }[] = [];

  private lastLazyEvent: any = { first: 0, rows: 20, sortField: 'lastEventTimeUtc', sortOrder: -1 };
  private searchDebounceTimer: any;

  ngOnInit(): void {
    this.statusOptions = [
      { label: this.translate.instant('ENTRANCE_EXIT_LOGS.STATUS_ARRIVED'), value: 'arrived' },
      { label: this.translate.instant('ENTRANCE_EXIT_LOGS.STATUS_CHECKED_IN'), value: 'checked-in' },
      { label: this.translate.instant('ENTRANCE_EXIT_LOGS.STATUS_CHECKED_OUT'), value: 'checked-out' },
    ];
    this.loadData();
  }

  statusLabel(status: number): string {
    switch (status) {
      case 1: return this.translate.instant('ENTRANCE_EXIT_LOGS.STATUS_ARRIVED');
      case 2: return this.translate.instant('ENTRANCE_EXIT_LOGS.STATUS_CHECKED_IN');
      case 3: return this.translate.instant('ENTRANCE_EXIT_LOGS.STATUS_CHECKED_OUT');
      default: return this.translate.instant('ENTRANCE_EXIT_LOGS.STATUS_PENDING');
    }
  }

  onFilterChange(): void {
    this.first = 0;
    this.lastLazyEvent.first = 0;
    this.loadData();
  }

  onSearchInput(): void {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => this.onFilterChange(), 350);
  }

  onLazyLoad(event: any): void {
    this.lastLazyEvent = event;
    this.first = event.first ?? 0;
    this.rows = event.rows ?? 20;
    this.loadData(event);
  }

  loadData(event?: any): void {
    this.loading = true;
    this.error = false;
    this.cdr.markForCheck();

    const ev = event ?? this.lastLazyEvent;
    const page = Math.floor((ev.first ?? 0) / (ev.rows ?? 20)) + 1;

    const query = this.buildQuery(page, ev.rows ?? 20, ev.sortField, ev.sortOrder);

    this.visitsApi.getEntranceExitLogs(query).subscribe({
      next: (res) => {
        this.items = res.items;
        this.totalRecords = res.total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = true;
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  exportData(): void {
    const ev = this.lastLazyEvent ?? {};
    const query = this.buildQuery(1, 999999, ev.sortField, ev.sortOrder);

    this.visitsApi.downloadEntranceExitLogs(query).subscribe((blob) => {
      downloadBlob(blob, 'entrance-exit-logs.xlsx');
    });
  }

  private buildQuery(page: number, limit: number, sortField?: string, sortOrder?: number): EntranceExitLogQuery {
    const query: EntranceExitLogQuery = { page, limit };

    if (this.dateFrom) {
      query.dateFrom = this.formatDate(this.dateFrom);
    }
    if (this.dateTo) {
      query.dateTo = this.formatDate(this.dateTo);
    }
    if (this.selectedStatus) {
      query.status = this.selectedStatus;
    }
    if (this.searchText?.trim()) {
      query.search = this.searchText.trim();
    }

    if (sortField) {
      query.sortBy = sortField;
      query.sortOrder = sortOrder === 1 ? 'ASC' : 'DESC';
    }

    return query;
  }

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
