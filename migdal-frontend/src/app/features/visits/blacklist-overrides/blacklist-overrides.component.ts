import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { VisitsApiService } from '../services/visits-api.service';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';

@Component({
  selector: 'app-blacklist-overrides',
  standalone: true,
  imports: [
    TranslateModule,
    FormsModule,
    TableModule,
    InputTextModule,
    DropdownModule,
    DialogModule,
    TooltipModule,
    HasPermissionDirective,
    DateFormatPipe,
  ],
  template: `
    <div class="page-header">
      <h1>{{ 'BLACKLIST_OVERRIDE.TITLE' | translate }}</h1>
    </div>

    <div class="card table-card">
      <p-table
        [value]="items"
        [lazy]="true"
        (onLazyLoad)="onLazyLoad($event)"
        [paginator]="true"
        [rows]="rows"
        [totalRecords]="totalRecords"
        [first]="first"
        [rowsPerPageOptions]="[10, 20, 50]"
        [loading]="loading"
        [showCurrentPageReport]="true"
        currentPageReportTemplate="{first}-{last} / {totalRecords}"
        paginatorDropdownAppendTo="body"
        dataKey="id"
        styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
      >
        <ng-template pTemplate="caption">
          <div class="table-header">
            <span class="p-input-icon-left">
              <i class="pi pi-search"></i>
              <input pInputText type="text" [(ngModel)]="searchTerm"
                (input)="onSearch()" [placeholder]="'COMMON.SEARCH' | translate" />
            </span>
            <p-dropdown [options]="statusOptions" [(ngModel)]="statusFilter"
              (onChange)="onStatusChange()" [placeholder]="'BLACKLIST_OVERRIDE.ALL_STATUSES' | translate"
              optionLabel="label" optionValue="value" appendTo="body"
              [showClear]="true" [style]="{minWidth: '160px'}">
            </p-dropdown>
          </div>
        </ng-template>

        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="visitorName">{{ 'BLACKLIST_OVERRIDE.VISITOR' | translate }} <p-sortIcon field="visitorName" /> <p-columnFilter field="visitorName" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="visitorPersonId">{{ 'BLACKLIST_OVERRIDE.PERSON_ID' | translate }} <p-sortIcon field="visitorPersonId" /> <p-columnFilter field="visitorPersonId" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="visitTitle">{{ 'BLACKLIST_OVERRIDE.VISIT_TITLE' | translate }} <p-sortIcon field="visitTitle" /> <p-columnFilter field="visitTitle" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="createdBy">{{ 'BLACKLIST_OVERRIDE.CREATED_BY' | translate }} <p-sortIcon field="createdBy" /> <p-columnFilter field="createdBy" type="text" display="menu"></p-columnFilter></th>
            <th>{{ 'BLACKLIST_OVERRIDE.BLACKLIST_REASON' | translate }}</th>
            <th>{{ 'BLACKLIST_OVERRIDE.BLOCKED_UNTIL' | translate }}</th>
            <th pSortableColumn="status">{{ 'BLACKLIST_OVERRIDE.STATUS' | translate }} <p-sortIcon field="status" /></th>
            <th pSortableColumn="createdAt">{{ 'BLACKLIST_OVERRIDE.REQUESTED_AT' | translate }} <p-sortIcon field="createdAt" /> <p-columnFilter field="createdAt" type="date" display="menu"></p-columnFilter></th>
            <th pSortableColumn="reviewedBy">{{ 'BLACKLIST_OVERRIDE.REVIEWED_BY' | translate }} <p-sortIcon field="reviewedBy" /> <p-columnFilter field="reviewedBy" type="text" display="menu"></p-columnFilter></th>
            <th>{{ 'BLACKLIST_OVERRIDE.REVIEW_NOTE' | translate }}</th>
            <th *hasPermission="'blacklist.approve'">{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-item>
          <tr>
            <td class="name-cell">{{ item.visitVisitor?.visitor?.firstName }} {{ item.visitVisitor?.visitor?.lastName }}</td>
            <td>{{ item.visitVisitor?.visitor?.personId || '-' }}</td>
            <td>{{ item.visitVisitor?.visit?.title }}</td>
            <td>{{ item.visitVisitor?.visit?.createdByUser ? (item.visitVisitor.visit.createdByUser.firstName + ' ' + item.visitVisitor.visit.createdByUser.lastName) : '-' }}</td>
            <td>{{ item.blacklistReason || '-' }}</td>
            <td dir="ltr">{{ item.blacklistEntry?.blockedUntil ? (item.blacklistEntry.blockedUntil | dateFormat) : ('BLACKLIST.PERMANENT' | translate) }}</td>
            <td>
              <span class="status-badge" [class]="getStatusClass(item.status)">
                {{ getStatusTranslationKey(item.status) | translate }}
              </span>
            </td>
            <td dir="ltr">{{ item.createdAt | dateFormat }}</td>
            <td>{{ item.reviewedByUser ? (item.reviewedByUser.firstName + ' ' + item.reviewedByUser.lastName) : '-' }}</td>
            <td>{{ item.reviewNote || '-' }}</td>
            <td *hasPermission="'blacklist.approve'">
              <div class="actions">
                  <button class="btn-icon success" (click)="openReviewDialog(item, 'approved')"
                    [pTooltip]="'BLACKLIST_OVERRIDE.APPROVE' | translate" tooltipPosition="top"
                    [disabled]="item.status === 'approved' || item.status === 'cancelled'">
                    <i class="pi pi-check"></i>
                  </button>
                  <button class="btn-icon warning" (click)="openReviewDialog(item, 'approved_escort')"
                    [pTooltip]="'BLACKLIST_OVERRIDE.APPROVE_ESCORT' | translate" tooltipPosition="top"
                    [disabled]="item.status === 'approved_escort' || item.status === 'cancelled'">
                    <i class="pi pi-users"></i>
                  </button>
                  <button class="btn-icon info" (click)="openReviewDialog(item, 'approved_security')"
                    [pTooltip]="'BLACKLIST_OVERRIDE.APPROVE_SECURITY' | translate" tooltipPosition="top"
                    [disabled]="item.status === 'approved_security' || item.status === 'cancelled'">
                    <i class="pi pi-shield"></i>
                  </button>
                  <button class="btn-icon danger" (click)="openReviewDialog(item, 'denied')"
                    [pTooltip]="'BLACKLIST_OVERRIDE.DENY' | translate" tooltipPosition="top"
                    [disabled]="item.status === 'denied' || item.status === 'cancelled'">
                    <i class="pi pi-times"></i>
                  </button>
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr><td [attr.colspan]="11" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Review Dialog -->
    <p-dialog [header]="getDialogHeader()"
      [(visible)]="showReviewDialog" [modal]="true" [style]="{width: '400px'}" [draggable]="false">
      @if (showReviewDialog) {
        <div class="dialog-form">
          <div class="field">
            <label>{{ 'BLACKLIST_OVERRIDE.REVIEW_NOTE' | translate }}</label>
            <textarea [(ngModel)]="reviewNote" rows="3"
              [placeholder]="'BLACKLIST_OVERRIDE.REVIEW_NOTE_PLACEHOLDER' | translate"></textarea>
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showReviewDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="submitReview()" [disabled]="saving">
          {{ getDialogHeader() }}
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host { display: block; }
    .table-card { padding: 0; overflow: hidden; }
    .table-header { display: flex; align-items: center; gap: 0.75rem; }
    .p-input-icon-left { position: relative; }
    .p-input-icon-left i { position: absolute; top: 50%; transform: translateY(-50%); inset-inline-start: 0.75rem; color: var(--color-text-muted, #9896ad); }
    .p-input-icon-left input { padding-inline-start: 2.25rem; }
    .name-cell { font-weight: 500; }
    .actions { display: flex; gap: 0.3rem; align-items: center; }
    .empty { text-align: center; color: var(--color-text-muted); padding: 2rem !important; font-size: 0.88rem; }
    .dialog-form { display: flex; flex-direction: column; gap: 1rem; }
    .dialog-form .field { display: flex; flex-direction: column; gap: 0.3rem; }
    .dialog-form .field label { font-weight: 500; font-size: 0.85rem; color: var(--color-text-secondary); }
    .btn-icon.success { color: var(--color-text-muted); }
    .btn-icon.success:hover { background: rgba(34, 197, 94, 0.08); color: #15803d; border-color: rgba(34, 197, 94, 0.15); }
    .btn-icon.warning { color: var(--color-text-muted); }
    .btn-icon.warning:hover { background: rgba(234, 179, 8, 0.08); color: #a16207; border-color: rgba(234, 179, 8, 0.15); }
    .btn-icon.info { color: var(--color-text-muted); }
    .btn-icon.info:hover { background: rgba(59, 130, 246, 0.08); color: #1d4ed8; border-color: rgba(59, 130, 246, 0.15); }
  `],
})
export class BlacklistOverridesComponent implements OnInit {
  private visitsApi = inject(VisitsApiService);
  private notify = inject(NotificationService);
  private translate = inject(TranslateService);

  items: any[] = [];
  totalRecords = 0;
  rows = 20;
  first = 0;
  loading = false;
  saving = false;
  searchTerm = '';
  statusFilter: string | null = null;
  lastLazyEvent: any = null;

  showReviewDialog = false;
  reviewAction: 'approved' | 'denied' | 'approved_escort' | 'approved_security' = 'approved';
  reviewNote = '';
  reviewingItem: any = null;

  statusOptions: { label: string; value: string }[] = [];

  ngOnInit(): void {
    this.statusOptions = [
      { label: this.translate.instant('BLACKLIST_OVERRIDE.STATUS_PENDING'), value: 'pending' },
      { label: this.translate.instant('BLACKLIST_OVERRIDE.STATUS_APPROVED'), value: 'approved' },
      { label: this.translate.instant('BLACKLIST_OVERRIDE.STATUS_APPROVED_ESCORT'), value: 'approved_escort' },
      { label: this.translate.instant('BLACKLIST_OVERRIDE.STATUS_APPROVED_SECURITY'), value: 'approved_security' },
      { label: this.translate.instant('BLACKLIST_OVERRIDE.STATUS_DENIED'), value: 'denied' },
      { label: this.translate.instant('BLACKLIST_OVERRIDE.STATUS_CANCELLED'), value: 'cancelled' },
    ];
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'status-badge pending',
      approved: 'status-badge approved',
      approved_escort: 'status-badge approved',
      approved_security: 'status-badge approved',
      denied: 'status-badge denied',
      cancelled: 'status-badge denied',
    };
    return map[status] ?? 'status-badge unknown';
  }

  getStatusTranslationKey(status: string): string {
    return 'BLACKLIST_OVERRIDE.STATUS_' + (status ?? '').toUpperCase();
  }

  onLazyLoad(event: any): void {
    this.lastLazyEvent = event;
    this.loading = true;
    this.first = event.first ?? 0;
    this.rows = event.rows ?? 20;
    const page = Math.floor(this.first / this.rows) + 1;
    const sortBy = event.sortField ?? undefined;
    const sortOrder = event.sortOrder === 1 ? 'ASC' : 'DESC';

    this.visitsApi.getBlacklistOverrideRequests({
      page, limit: this.rows, status: this.statusFilter ?? undefined, search: this.searchTerm || undefined, sortBy, sortOrder,
      filters: JSON.stringify(event.filters ?? {}),
    }).subscribe({
      next: (r) => {
        this.items = r.items;
        this.totalRecords = r.total;
        this.loading = false;
      },
      error: () => { this.loading = false; this.notify.error('COMMON.ERROR'); },
    });
  }

  onSearch(): void {
    this.first = 0;
    if (this.lastLazyEvent) {
      this.lastLazyEvent.first = 0;
      this.onLazyLoad(this.lastLazyEvent);
    }
  }

  onStatusChange(): void {
    this.first = 0;
    if (this.lastLazyEvent) {
      this.lastLazyEvent.first = 0;
      this.onLazyLoad(this.lastLazyEvent);
    }
  }

  getDialogHeader(): string {
    const map: Record<string, string> = {
      approved: this.translate.instant('BLACKLIST_OVERRIDE.APPROVE'),
      denied: this.translate.instant('BLACKLIST_OVERRIDE.DENY'),
      approved_escort: this.translate.instant('BLACKLIST_OVERRIDE.APPROVE_ESCORT'),
      approved_security: this.translate.instant('BLACKLIST_OVERRIDE.APPROVE_SECURITY'),
    };
    return map[this.reviewAction] ?? '';
  }

  openReviewDialog(item: any, action: 'approved' | 'denied' | 'approved_escort' | 'approved_security'): void {
    this.reviewingItem = item;
    this.reviewAction = action;
    this.reviewNote = item.reviewNote ?? '';
    this.showReviewDialog = true;
  }

  submitReview(): void {
    if (!this.reviewingItem) return;
    this.saving = true;
    this.visitsApi.reviewBlacklistOverride(this.reviewingItem.id, {
      status: this.reviewAction,
      reviewNote: this.reviewNote || undefined,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showReviewDialog = false;
        this.notify.success('COMMON.SUCCESS');
        if (this.lastLazyEvent) this.onLazyLoad(this.lastLazyEvent);
      },
      error: () => { this.saving = false; this.notify.error('COMMON.ERROR'); },
    });
  }
}
