import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { VisitsApiService } from '../services/visits-api.service';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { downloadBlob } from '@core/utils/download.util';
import { BuildingsApiService, Building as BuildingItem } from '../../settings/services/buildings-api.service';
import { Visit } from '@core/models/entities.model';
import { PermissionService } from '@core/permissions/permission.service';
import { TodaySummaryComponent } from './today-summary.component';
import { VisitDialogComponent } from './visit-dialog.component';

@Component({
  selector: 'app-visit-list',
  standalone: true,
  imports: [
    DateFormatPipe,
    TranslateModule,
    HasPermissionDirective,
    TableModule,
    InputTextModule,
    DialogModule,
    TodaySummaryComponent,
    VisitDialogComponent,
  ],
  template: `
    <div class="page-header">
      <h1>{{ 'VISITS.TITLE' | translate }}</h1>
      <div class="header-actions">
        <button class="btn btn-outline" *hasPermission="'visits.read'" (click)="exportData()">
          <i class="pi pi-file-excel"></i> {{ 'COMMON.EXPORT' | translate }}
        </button>
        <button class="btn btn-primary" *hasPermission="'visits.create'" (click)="openDialog()">
          <i class="pi pi-plus"></i> {{ 'VISITS.CREATE_VISIT' | translate }}
        </button>
      </div>
    </div>
    <app-today-summary></app-today-summary>
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
        [rowsPerPageOptions]="[10, 20, 50]"
        dataKey="id"
        styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
        currentPageReportTemplate="{first}-{last} / {totalRecords}"
        paginatorDropdownAppendTo="body"
      >
        <ng-template pTemplate="caption">
          <div class="table-header">
            <span class="p-input-icon-left">
              <i class="pi pi-search"></i>
              <input pInputText type="text" (input)="dt.filterGlobal($any($event.target).value, 'contains')" [placeholder]="'COMMON.SEARCH' | translate" />
            </span>
            <div class="time-filter-group" role="group" [attr.aria-label]="'VISITS.TIME_FILTER' | translate">
              <button type="button" class="time-filter-btn" [class.active]="activeTimeFilter === 'today'" (click)="onTimeFilterChange('today')" [attr.aria-pressed]="activeTimeFilter === 'today'">
                <i class="pi pi-calendar"></i> {{ 'VISITS.FILTER_TODAY' | translate }}
              </button>
              <button type="button" class="time-filter-btn" [class.active]="activeTimeFilter === 'future'" (click)="onTimeFilterChange('future')" [attr.aria-pressed]="activeTimeFilter === 'future'">
                <i class="pi pi-arrow-right"></i> {{ 'VISITS.FILTER_FUTURE' | translate }}
              </button>
              <button type="button" class="time-filter-btn" [class.active]="activeTimeFilter === 'history'" (click)="onTimeFilterChange('history')" [attr.aria-pressed]="activeTimeFilter === 'history'">
                <i class="pi pi-history"></i> {{ 'VISITS.FILTER_HISTORY' | translate }}
              </button>
              <button type="button" class="time-filter-btn" [class.active]="!activeTimeFilter" (click)="onTimeFilterChange(null)" [attr.aria-pressed]="!activeTimeFilter">
                <i class="pi pi-inbox"></i> {{ 'VISITS.FILTER_ARCHIVE' | translate }}
              </button>
            </div>
          </div>
        </ng-template>
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="title">{{ 'VISITS.VISIT_TITLE' | translate }} <p-sortIcon field="title" /> <p-columnFilter field="title" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="buildingName">{{ 'BUILDINGS.BUILDING' | translate }} <p-sortIcon field="buildingName" /> <p-columnFilter field="buildingName" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="floor">{{ 'VISITS.FLOOR' | translate }} <p-sortIcon field="floor" /> <p-columnFilter field="floor" type="numeric" display="menu"></p-columnFilter></th>
            <th pSortableColumn="plannedStartTimeUtc">{{ 'VISITS.PLANNED_START' | translate }} <p-sortIcon field="plannedStartTimeUtc" /> <p-columnFilter field="plannedStartTimeUtc" type="date" display="menu"></p-columnFilter></th>
            <th pSortableColumn="plannedEndTimeUtc">{{ 'VISITS.PLANNED_END' | translate }} <p-sortIcon field="plannedEndTimeUtc" /> <p-columnFilter field="plannedEndTimeUtc" type="date" display="menu"></p-columnFilter></th>
            <th>{{ 'VISITS.VISITORS_SUMMARY' | translate }}</th>
            <th pSortableColumn="createdAt">{{ 'COMMON.CREATED_AT' | translate }} <p-sortIcon field="createdAt" /> <p-columnFilter field="createdAt" type="date" display="menu"></p-columnFilter></th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-visit>
          <tr class="clickable-row" (click)="goToDetail(visit.id)">
            <td class="name-cell">{{ visit.title }}</td>
            <td>{{ visit.buildingName || '-' }}</td>
            <td>{{ visit.floor ?? '-' }}</td>
            <td dir="ltr">{{ visit.plannedStartTimeUtc | dateFormat }}</td>
            <td>
              @if (visit.plannedEndTimeUtc) {
                {{ visit.plannedEndTimeUtc | dateFormat }}
              } @else {
                <span class="text-muted">-</span>
              }
            </td>
            <td>
              @if (visit.statusSummary) {
                <div class="status-summary">
                  <span class="status-chip total"><i class="pi pi-users"></i> {{ visit.statusSummary.total }}</span>
                  @if (visit.statusSummary.pending > 0) {
                    <span class="status-chip pending" [title]="'VISITS.STATUS_PENDING' | translate"><i class="pi pi-clock"></i> {{ visit.statusSummary.pending }}</span>
                  }
                  @if (visit.statusSummary.arrived > 0) {
                    <span class="status-chip arrived" [title]="'VISITS.STATUS_ARRIVED' | translate"><i class="pi pi-sign-in"></i> {{ visit.statusSummary.arrived }}</span>
                  }
                  @if (visit.statusSummary.checkedIn > 0) {
                    <span class="status-chip checked-in" [title]="'VISITS.STATUS_CHECKED_IN' | translate"><i class="pi pi-check-circle"></i> {{ visit.statusSummary.checkedIn }}</span>
                  }
                  @if (visit.statusSummary.checkedOut > 0) {
                    <span class="status-chip checked-out" [title]="'VISITS.STATUS_CHECKED_OUT' | translate"><i class="pi pi-sign-out"></i> {{ visit.statusSummary.checkedOut }}</span>
                  }
                </div>
              } @else {
                <span class="text-muted">0</span>
              }
            </td>
            <td dir="ltr">{{ visit.createdAt | dateFormat }}</td>
            <td class="actions" (click)="$event.stopPropagation()">
              <button class="btn-icon" (click)="showRequester(visit)" [title]="'VISITS.VISIT_REQUESTER' | translate">
                <i class="pi pi-id-card"></i>
              </button>
              <button class="btn-icon" *hasPermission="'visits.update'" (click)="openDialog(visit)" [title]="'COMMON.EDIT' | translate">
                <i class="pi pi-pencil"></i>
              </button>
              <button class="btn-icon" (click)="goToDetail(visit.id)" [title]="'VISITS.VIEW_DETAIL' | translate">
                <i class="pi pi-eye"></i>
              </button>
              @if (canDeleteVisit(visit)) {
                <button class="btn-icon danger" (click)="onDelete(visit)" [title]="'COMMON.DELETE' | translate">
                  <i class="pi pi-trash"></i>
                </button>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="9" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <app-visit-dialog #visitDialog
      [buildings]="buildings"
      (saved)="loadData()">
    </app-visit-dialog>

    <p-dialog [(visible)]="requesterDialogVisible"
              [header]="'VISITS.VISIT_REQUESTER' | translate"
              [modal]="true"
              [style]="{width: '420px'}"
              [draggable]="false">
      @if (selectedVisit?.visitRequester; as req) {
        <div class="requester-card">
          <div class="requester-avatar">
            <i class="pi pi-user"></i>
          </div>
          <div class="requester-name">{{ req.firstName }} {{ req.lastName }}</div>
        </div>
        <div class="detail-grid">
          <div class="detail-row">
            <span class="detail-label"><i class="pi pi-user"></i> {{ 'VISITS.FIRST_NAME' | translate }}</span>
            <span class="detail-value">{{ req.firstName }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label"><i class="pi pi-user"></i> {{ 'VISITS.LAST_NAME' | translate }}</span>
            <span class="detail-value">{{ req.lastName }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label"><i class="pi pi-phone"></i> {{ 'VISITS.PHONE' | translate }}</span>
            <span class="detail-value" dir="ltr">{{ req.phone || '-' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label"><i class="pi pi-envelope"></i> {{ 'VISITS.EMAIL' | translate }}</span>
            <span class="detail-value">{{ req.email || '-' }}</span>
          </div>
        </div>
      } @else {
        <div class="no-requester">
          <i class="pi pi-info-circle"></i>
          <span>{{ 'VISITS.NO_REQUESTER' | translate }}</span>
        </div>
      }
    </p-dialog>
  `,
  styles: [`
    :host { display: block; }
    .table-card { padding: 0; overflow: hidden; }
    .table-header { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .p-input-icon-left { position: relative; }
    .p-input-icon-left i { position: absolute; top: 50%; transform: translateY(-50%); inset-inline-start: 0.75rem; color: var(--color-text-muted, #9896ad); }
    .p-input-icon-left input { padding-inline-start: 2.25rem; }
    .name-cell { font-weight: 500; }
    .header-actions { display: flex; gap: 0.5rem; }
    .actions { display: flex; gap: 0.3rem; align-items: center; }
    .empty { text-align: center; color: var(--color-text-muted); padding: 2rem !important; font-size: 0.88rem; }
    .text-muted { color: var(--color-text-muted); }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background: rgba(108, 99, 255, 0.04); }

    /* -- Time filter button group -- */
    .time-filter-group {
      display: inline-flex; border-radius: 8px; overflow: hidden;
      border: 1.5px solid var(--color-border, #e0dfe6); background: var(--color-surface, #fff);
    }
    .time-filter-btn {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.4rem 0.85rem; font-size: 0.82rem; font-weight: 500;
      border: none; background: transparent; color: var(--color-text-muted, #9896ad);
      cursor: pointer; transition: all 0.18s ease; white-space: nowrap;
      border-inline-end: 1px solid var(--color-border, #e0dfe6);
    }
    .time-filter-btn:last-child { border-inline-end: none; }
    .time-filter-btn:hover { background: rgba(108, 99, 255, 0.06); color: var(--color-text-primary, #23223a); }
    .time-filter-btn:focus-visible { outline: 2px solid var(--color-primary, #6c63ff); outline-offset: -2px; z-index: 1; }
    .time-filter-btn.active {
      background: var(--color-primary, #6c63ff); color: #fff;
    }
    .time-filter-btn.active:hover { background: var(--color-primary-hover, #5b53e0); }
    .time-filter-btn i { font-size: 0.85rem; }

    /* -- Status chips -- */
    .status-summary { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
    .status-chip {
      display: inline-flex; align-items: center; gap: 0.25rem;
      padding: 0.25rem 0.6rem; border-radius: 999px;
      font-size: 0.75rem; font-weight: 600;
      line-height: 1.3; white-space: nowrap;
      border: 1px solid transparent;
      transition: background 0.2s ease, border-color 0.2s ease;
    }
    .status-chip i { font-size: 0.68rem; }
    .status-chip.total { background: rgba(108, 99, 255, 0.10); color: #6c63ff; border-color: rgba(108, 99, 255, 0.18); }
    .status-chip.pending { background: rgba(245, 158, 11, 0.10); color: #b45309; border-color: rgba(245, 158, 11, 0.20); }
    .status-chip.arrived { background: rgba(59, 130, 246, 0.10); color: #1d4ed8; border-color: rgba(59, 130, 246, 0.20); }
    .status-chip.checked-in { background: rgba(34, 197, 94, 0.10); color: #15803d; border-color: rgba(34, 197, 94, 0.20); }
    .status-chip.checked-out { background: rgba(100, 116, 139, 0.10); color: #475569; border-color: rgba(100, 116, 139, 0.20); }

    /* Requester detail dialog */
    .requester-card {
      display: flex; flex-direction: column; align-items: center;
      padding: 0.5rem 0 1.25rem; gap: 0.6rem;
    }
    .requester-avatar {
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #6c63ff 0%, #48c6ef 100%);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 1.5rem;
    }
    .requester-name {
      font-size: 1.1rem; font-weight: 600;
      color: var(--color-text-primary, #23223a);
    }
    .detail-grid { display: flex; flex-direction: column; gap: 0; }
    .detail-row {
      display: flex; gap: 1rem; align-items: center;
      padding: 0.65rem 0.75rem;
      border-bottom: 1px solid var(--color-border-light, #f0eff5);
      transition: background 0.15s;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-row:hover { background: rgba(108, 99, 255, 0.03); }
    .detail-label {
      display: flex; align-items: center; gap: 0.45rem;
      font-weight: 600; min-width: 120px;
      color: var(--color-text-secondary, #5c5a78);
      font-size: 0.84rem; flex-shrink: 0;
    }
    .detail-label i { font-size: 0.9rem; color: var(--color-primary, #6c63ff); }
    .detail-value { font-size: 0.9rem; color: var(--color-text-primary, #23223a); }
    .no-requester {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 1.5rem; justify-content: center;
      color: var(--color-text-muted, #9896ad); font-size: 0.9rem;
    }
    .no-requester i { font-size: 1.1rem; }
  `],
})
export class VisitListComponent implements OnInit {
  @ViewChild('visitDialog') visitDialog!: VisitDialogComponent;

  private visitsApi = inject(VisitsApiService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private buildingsApi = inject(BuildingsApiService);
  private confirmService = inject(ConfirmService);
  private permissionService = inject(PermissionService);

  items: Visit[] = [];
  totalRecords = 0;
  rows = 20;
  first = 0;
  sortField = 'plannedStartTimeUtc';
  sortOrder = -1;
  loading = false;
  activeTimeFilter: 'today' | 'future' | 'history' | null = 'today';
  private lastLazyEvent: any = { first: 0, rows: 20, sortField: 'plannedStartTimeUtc', sortOrder: -1, filters: {} };

  buildings: BuildingItem[] = [];
  requesterDialogVisible = false;
  selectedVisit: Visit | null = null;

  ngOnInit(): void {
    this.loadData();
    this.loadBuildings();
  }

  loadBuildings(): void {
    this.buildingsApi.getAll({ limit: 100, active: 1 }).subscribe({
      next: (r) => { this.buildings = r.items; },
      error: () => { },
    });
  }

  loadData(event: any = this.lastLazyEvent): void {
    this.loading = true;
    this.lastLazyEvent = event;
    this.first = event.first ?? 0;
    this.rows = event.rows ?? 20;
    this.sortField = event.sortField || 'plannedStartTimeUtc';
    this.sortOrder = event.sortOrder || -1;

    const page = Math.floor(this.first / this.rows) + 1;
    const params: Record<string, string | number> = {
      page,
      limit: this.rows,
      sortBy: this.sortField,
      sortOrder: this.sortOrder === 1 ? 'ASC' : 'DESC',
      filters: JSON.stringify(event.filters ?? {}),
    };
    const global = event.filters?.global?.value;
    if (global) params['search'] = global;
    if (this.activeTimeFilter) params['timeFilter'] = this.activeTimeFilter;

    this.visitsApi.getVisits(params).subscribe({
      next: (r) => {
        this.items = r.items;
        this.totalRecords = r.total;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  onTimeFilterChange(filter: 'today' | 'future' | 'history' | null): void {
    this.activeTimeFilter = filter;
    this.first = 0;
    this.lastLazyEvent = { ...this.lastLazyEvent, first: 0 };
    this.loadData(this.lastLazyEvent);
  }

  onLazyLoad(event: any): void {
    this.loadData(event);
  }

  goToDetail(visitId: string): void {
    if (!this.permissionService.hasPermission('visits.read')) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    this.router.navigate(['/visits', visitId]);
  }

  openDialog(visit?: Visit): void {
    const canOpen = visit
      ? this.permissionService.hasPermission('visits.update')
      : this.permissionService.hasPermission('visits.create');
    if (!canOpen) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    this.visitDialog.open(visit);
  }

  showRequester(visit: Visit): void {
    this.selectedVisit = visit;
    this.requesterDialogVisible = true;
  }

  async onDelete(visit: Visit): Promise<void> {
    if (!this.canDeleteVisit(visit)) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    if (!await this.confirmService.confirm('VISITS.DELETE_CONFIRM')) return;
    this.visitsApi.deleteVisit(visit.id).subscribe({
      next: () => { this.notify.success('COMMON.SUCCESS'); this.loadData(); },
      error: (err) => this.notify.error(err),
    });
  }

  exportData(): void {
    if (!this.permissionService.hasPermission('visits.read')) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    const event = this.lastLazyEvent ?? {};
    const params: Record<string, string | number> = {
      sortBy: event.sortField || 'plannedStartTimeUtc',
      sortOrder: (event.sortOrder || -1) === 1 ? 'ASC' : 'DESC',
      filters: JSON.stringify(event.filters ?? {}),
    };
    const global = event.filters?.global?.value;
    if (global) params['search'] = global;
    if (this.activeTimeFilter) params['timeFilter'] = this.activeTimeFilter;

    this.visitsApi.exportVisits(params).subscribe({
      next: (blob) => {
        downloadBlob(blob, 'visits.xlsx');
      },
      error: (err) => this.notify.error(err),
    });
  }

  canDeleteVisit(visit: Visit): boolean {
    if (!this.permissionService.hasPermission('visits.delete')) {
      return false;
    }

    if (!this.permissionService.hasPermission('visits.delete.own-only')) {
      return true;
    }

    const currentUserId = this.permissionService.getCurrentUserId();
    if (!currentUserId) {
      return false;
    }

    return visit.createdByUserId === currentUserId;
  }
}