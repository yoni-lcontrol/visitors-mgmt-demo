import { Component, Input, Output, EventEmitter } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { VisitVisitor, VisitorStatus, VisitorAccessEventType } from '@core/models/entities.model';

@Component({
    selector: 'app-visit-visitors-table',
    standalone: true,
    imports: [TranslateModule, HasPermissionDirective, DateFormatPipe],
    template: `
    <div class="card">
      <h3 class="section-title"><i class="pi pi-users"></i> {{ 'VISITS.VISITORS' | translate }}</h3>
      @if (loading) {
        <div class="loading-msg">{{ 'COMMON.LOADING' | translate }}</div>
      } @else if (visitors.length === 0) {
        <div class="empty-msg">{{ 'COMMON.NO_DATA' | translate }}</div>
      } @else {
        <div class="data-table">
          <table>
            <thead>
              <tr>
                <th>{{ 'COMMON.NAME' | translate }}</th>
                <th>{{ 'VISITORS.PERSON_ID' | translate }}</th>
                <th>{{ 'VISITORS.CAR_NUMBER' | translate }}</th>
                <th>{{ 'VISITORS.VEHICLE_TYPE' | translate }}</th>
                <th>{{ 'VISITS.PHONE' | translate }}</th>
                <th>{{ 'VISITS.CHECK_IN_CODE' | translate }}</th>
                <th>{{ 'COMMON.STATUS' | translate }}</th>
                <th>{{ 'VISITS.LAST_EVENT' | translate }}</th>
                <th>{{ 'COMMON.ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (vv of visitors; track vv.id) {
                <tr [class.blacklist-pending-row]="isBlacklistPending(vv)" [class.blacklist-denied-row]="isBlacklistDenied(vv)">
                  <td class="name-cell">
                    @if (vv.visitor) {
                      <span [class.visitor-name-blocked]="isBlacklistPending(vv) || isBlacklistDenied(vv)">
                        {{ vv.visitor.fullName || (vv.visitor.firstName + ' ' + vv.visitor.lastName) }}
                      </span>
                    } @else { - }
                    @if (isBlacklistPending(vv)) {
                      <span class="blacklist-pending-badge">
                        <i class="pi pi-exclamation-triangle"></i>
                        {{ 'VISITS.BLACKLIST_PENDING_APPROVAL' | translate }}
                      </span>
                    }
                    @if (isBlacklistDenied(vv)) {
                      <span class="blacklist-denied-badge">
                        <i class="pi pi-ban"></i>
                        {{ 'VISITS.BLACKLIST_DENIED' | translate }}
                      </span>
                    }
                  </td>
                  <td>{{ vv.visitor?.personId ?? '-' }}</td>
                  <td>{{ vv.visitor?.carNumber ?? '-' }}</td>
                  <td>{{ vv.visitor?.vehicleType ?? '-' }}</td>
                  <td>{{ vv.visitor?.phone ?? '-' }}</td>
                  <td class="code-cell">{{ codeMap.get(vv.id) ?? '-' }}</td>
                  <td>
                    <span [class]="'status-badge ' + getStatusClass(vv.status?.currentStatus)">
                      {{ getStatusLabel(vv.status?.currentStatus) | translate }}
                    </span>
                  </td>
                  <td dir="ltr">{{ vv.status?.lastEventTimeUtc ? (vv.status!.lastEventTimeUtc! | dateFormat) : '-' }}</td>
                  <td class="actions">
                    @if ((isBlacklistPending(vv) || isBlacklistDenied(vv)) && vv.status?.currentStatus === statusCheckedIn) {
                      <span class="blacklist-alert-active">{{ 'VISITS.BLACKLIST_ACTIVE_ALERT' | translate }}</span>
                      <button class="btn btn-sm btn-check-out" *hasPermission="'visits.update'" (click)="registerEvent.emit({ vv, eventType: eventCheckedOut })">
                        <i class="pi pi-sign-out"></i> {{ 'VISITORS.CHECK_OUT' | translate }}
                      </button>
                      <button class="btn-icon" (click)="showHistory.emit(vv)" [title]="'VISITS.VIEW_HISTORY' | translate">
                        <i class="pi pi-history"></i>
                      </button>
                    } @else if (isBlacklistPending(vv)) {
                      <span class="blacklist-actions-blocked">{{ 'VISITS.ACTIONS_BLOCKED_BLACKLIST' | translate }}</span>
                      <button class="btn-icon" (click)="showHistory.emit(vv)" [title]="'VISITS.VIEW_HISTORY' | translate">
                        <i class="pi pi-history"></i>
                      </button>
                    } @else if (isBlacklistDenied(vv)) {
                      <span class="blacklist-actions-blocked">{{ 'VISITS.ACTIONS_BLOCKED_DENIED' | translate }}</span>
                      <button class="btn-icon" (click)="showHistory.emit(vv)" [title]="'VISITS.VIEW_HISTORY' | translate">
                        <i class="pi pi-history"></i>
                      </button>
                    } @else {
                    @if (vv.status?.currentStatus !== statusCheckedOut) {
                      @if (vv.status?.currentStatus === statusPending) {
                        <button class="btn btn-sm btn-arrived" *hasPermission="'visits.update'" (click)="registerEvent.emit({ vv, eventType: eventArrived })">
                          <i class="pi pi-sign-in"></i> {{ 'VISITS.ARRIVED' | translate }}
                        </button>
                      }
                      @if (vv.status?.currentStatus === statusArrived || vv.status?.currentStatus === statusPending) {
                        <button class="btn btn-sm btn-check-in" *hasPermission="'visits.update'" (click)="registerEvent.emit({ vv, eventType: eventCheckedIn })">
                          <i class="pi pi-check"></i> {{ 'VISITORS.CHECK_IN' | translate }}
                        </button>
                      }
                      @if (vv.status?.currentStatus === statusCheckedIn || vv.status?.currentStatus === statusArrived) {
                        <button class="btn btn-sm btn-check-out" *hasPermission="'visits.update'" (click)="registerEvent.emit({ vv, eventType: eventCheckedOut })">
                          <i class="pi pi-sign-out"></i> {{ 'VISITORS.CHECK_OUT' | translate }}
                        </button>
                      }
                    }
                    <button class="btn-icon" *hasPermission="'visits.update'" (click)="editVisitor.emit(vv)" [title]="'COMMON.EDIT' | translate">
                      <i class="pi pi-pencil"></i>
                    </button>
                    <button class="btn-icon" *hasPermission="'visits.check-in-code.send'" (click)="resendCode.emit(vv)" [title]="'VISITS.RESEND_CODE' | translate">
                      <i class="pi pi-send"></i>
                    </button>
                    <button class="btn-icon" *hasPermission="'visits.check-in-code.regenerate'" (click)="regenerateCode.emit(vv)" [title]="'VISITS.REGENERATE_CODE' | translate">
                      <i class="pi pi-refresh"></i>
                    </button>
                    <button class="btn-icon" (click)="showHistory.emit(vv)" [title]="'VISITS.VIEW_HISTORY' | translate">
                      <i class="pi pi-history"></i>
                    </button>
                    <button
                      class="btn-icon"
                      *hasPermission="'visits.print-card'"
                      (click)="printCard.emit(vv)"
                      [title]="getPrintCardTooltip()"
                      [disabled]="printingVisitorId === vv.id || !printerConnected"
                      [class.loading]="printingVisitorId === vv.id"
                    >
                      <i class="pi" [class.pi-print]="printingVisitorId !== vv.id" [class.pi-spin]="printingVisitorId === vv.id" [class.pi-spinner]="printingVisitorId === vv.id"></i>
                    </button>
                    <button class="btn-icon danger" *hasPermission="'visits.delete'" (click)="removeVisitor.emit(vv)" [title]="'COMMON.DELETE' | translate" [disabled]="visitors.length <= 1">
                      <i class="pi pi-trash"></i>
                    </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
    styles: [`
    :host { display: block; }
    .card { margin-bottom: 1.25rem; }
    .section-title {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 1.05rem; font-weight: 700;
      margin: 0 0 1rem 0;
      color: var(--color-primary, #020140);
    }
    .section-title i { color: var(--color-accent, #6c63ff); font-size: 1.05rem; }
    .data-table { overflow-x: auto; }
    .data-table table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.88rem; }
    .data-table th {
      text-align: start; padding: 0.75rem 0.85rem;
      font-weight: 600; font-size: 0.78rem;
      color: var(--color-text-muted);
      border-bottom: 2px solid var(--color-border, #e4e2f0);
      text-transform: uppercase; letter-spacing: 0.04em;
      background: var(--color-surface-alt, #f8f7fc);
      white-space: nowrap;
    }
    .data-table th:first-child { border-radius: 8px 0 0 0; }
    .data-table th:last-child { border-radius: 0 8px 0 0; }
    .data-table td {
      padding: 0.7rem 0.85rem;
      border-bottom: 1px solid var(--color-border-light, #eeedfa);
      vertical-align: middle;
    }
    .data-table tbody tr { transition: background 0.15s; }
    .data-table tbody tr:hover { background: rgba(108, 99, 255, 0.03); }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .name-cell { font-weight: 500; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
    .visitor-name-blocked { color: #dc2626; }
    .actions { display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; }
    .btn-sm {
      font-size: 0.78rem; padding: 0.38rem 0.8rem;
      border-radius: 8px; border: 1px solid transparent; cursor: pointer;
      font-weight: 600; font-family: inherit;
      display: inline-flex; align-items: center; gap: 0.35rem;
      transition: all 0.2s ease; white-space: nowrap;
    }
    .btn-sm:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
    .btn-arrived { background: rgba(59, 130, 246, 0.10); color: #1d4ed8; border-color: rgba(59, 130, 246, 0.20); }
    .btn-arrived:hover { background: rgba(59, 130, 246, 0.20); }
    .btn-check-in { background: rgba(34, 197, 94, 0.10); color: #15803d; border-color: rgba(34, 197, 94, 0.20); }
    .btn-check-in:hover { background: rgba(34, 197, 94, 0.20); }
    .btn-check-out { background: rgba(100, 116, 139, 0.10); color: #475569; border-color: rgba(100, 116, 139, 0.20); }
    .btn-check-out:hover { background: rgba(100, 116, 139, 0.20); }
    .status-badge {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.3rem 0.75rem; border-radius: 999px;
      font-size: 0.78rem; font-weight: 600;
      white-space: nowrap; border: 1px solid transparent;
    }
    .status-badge::before {
      content: ''; display: inline-block;
      width: 7px; height: 7px; border-radius: 50%;
      background: currentColor; opacity: 0.7; flex-shrink: 0;
    }
    .status-badge.status-pending { background: rgba(245, 158, 11, 0.10); color: #b45309; border-color: rgba(245, 158, 11, 0.20); }
    .status-badge.status-arrived { background: rgba(59, 130, 246, 0.10); color: #1d4ed8; border-color: rgba(59, 130, 246, 0.20); }
    .status-badge.status-checked-in { background: rgba(34, 197, 94, 0.10); color: #15803d; border-color: rgba(34, 197, 94, 0.20); }
    .status-badge.status-checked-out { background: rgba(100, 116, 139, 0.10); color: #475569; border-color: rgba(100, 116, 139, 0.20); }
    .loading-msg, .empty-msg { text-align: center; padding: 2.5rem; color: var(--color-text-muted); font-size: 0.9rem; }
    .blacklist-pending-row { background: rgba(239, 68, 68, 0.04); }
    .blacklist-pending-row:hover { background: rgba(239, 68, 68, 0.08) !important; }
    .blacklist-denied-row { background: rgba(239, 68, 68, 0.06); }
    .blacklist-denied-row:hover { background: rgba(239, 68, 68, 0.10) !important; }
    .blacklist-pending-badge {
      display: inline-flex; align-items: center; gap: 0.3rem;
      margin-inline-start: 0.5rem;
      padding: 0.15rem 0.55rem; border-radius: 999px;
      font-size: 0.72rem; font-weight: 600;
      background: rgba(239, 68, 68, 0.10); color: #dc2626;
      border: 1px solid rgba(239, 68, 68, 0.20);
    }
    .blacklist-pending-badge i { font-size: 0.72rem; }
    .blacklist-denied-badge {
      display: inline-flex; align-items: center; gap: 0.3rem;
      margin-inline-start: 0.5rem;
      padding: 0.15rem 0.55rem; border-radius: 999px;
      font-size: 0.72rem; font-weight: 600;
      background: rgba(239, 68, 68, 0.15); color: #b91c1c;
      border: 1px solid rgba(239, 68, 68, 0.30);
    }
    .blacklist-denied-badge i { font-size: 0.72rem; }
    .blacklist-actions-blocked {
      font-size: 0.75rem; font-weight: 500; color: #dc2626;
      white-space: nowrap;
    }
    .blacklist-alert-active {
      font-size: 0.75rem; font-weight: 600; color: #b91c1c;
      white-space: nowrap;
      animation: pulse-alert 2s ease-in-out infinite;
    }
    @keyframes pulse-alert {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `],
})
export class VisitVisitorsTableComponent {
    @Input() visitors: VisitVisitor[] = [];
    @Input() codeMap = new Map<string, string>();
    @Input() loading = false;
    @Input() printingVisitorId: string | null = null;
    @Input() printerConnected = false;

    @Output() registerEvent = new EventEmitter<{ vv: VisitVisitor; eventType: VisitorAccessEventType }>();
    @Output() editVisitor = new EventEmitter<VisitVisitor>();
    @Output() resendCode = new EventEmitter<VisitVisitor>();
    @Output() regenerateCode = new EventEmitter<VisitVisitor>();
    @Output() showHistory = new EventEmitter<VisitVisitor>();
    @Output() printCard = new EventEmitter<VisitVisitor>();
    @Output() removeVisitor = new EventEmitter<VisitVisitor>();

    readonly statusPending = VisitorStatus.Pending;
    readonly statusArrived = VisitorStatus.Arrived;
    readonly statusCheckedIn = VisitorStatus.CheckedIn;
    readonly statusCheckedOut = VisitorStatus.CheckedOut;
    readonly eventArrived = VisitorAccessEventType.Arrived;
    readonly eventCheckedIn = VisitorAccessEventType.CheckedIn;
    readonly eventCheckedOut = VisitorAccessEventType.CheckedOut;

    getStatusClass(status: number | undefined): string {
        switch (status) {
            case VisitorStatus.Pending: return 'status-pending';
            case VisitorStatus.Arrived: return 'status-arrived';
            case VisitorStatus.CheckedIn: return 'status-checked-in';
            case VisitorStatus.CheckedOut: return 'status-checked-out';
            default: return 'status-pending';
        }
    }

    getStatusLabel(status: number | undefined): string {
        switch (status) {
            case VisitorStatus.Pending: return 'VISITS.STATUS_PENDING';
            case VisitorStatus.Arrived: return 'VISITS.STATUS_ARRIVED';
            case VisitorStatus.CheckedIn: return 'VISITS.STATUS_CHECKED_IN';
            case VisitorStatus.CheckedOut: return 'VISITS.STATUS_CHECKED_OUT';
            default: return 'VISITS.STATUS_PENDING';
        }
    }

    getPrintCardTooltip(): string {
      return this.printerConnected ? 'VISITS.PRINT_CARD' : 'VISITS.PRINT_CARD_NO_PRINTER';
    }

    isBlacklistPending(vv: VisitVisitor): boolean {
      return vv.blacklistOverride?.status === 'pending';
    }

    isBlacklistDenied(vv: VisitVisitor): boolean {
      return vv.blacklistOverride?.status === 'denied';
    }
}
