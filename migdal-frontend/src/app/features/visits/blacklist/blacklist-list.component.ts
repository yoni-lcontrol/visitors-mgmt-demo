import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { CalendarModule } from 'primeng/calendar';
import { ApiService } from '@core/api/api.service';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { downloadBlob } from '@core/utils/download.util';
import { BlacklistEntry, User, PaginatedResult } from '@core/models/entities.model';

@Component({
  selector: 'app-blacklist-list',
  standalone: true,
  imports: [NgClass, DateFormatPipe, TranslateModule, FormsModule, HasPermissionDirective, TableModule, InputTextModule, DialogModule, MultiSelectModule, TooltipModule, CalendarModule],
  template: `
    <div class="page-header">
      <h1>{{ 'BLACKLIST.TITLE' | translate }}</h1>
      <div class="header-actions">
        <div class="view-toggle">
          <button class="btn" [class.btn-primary]="viewMode === 'active'" [class.btn-outline]="viewMode !== 'active'" (click)="switchView('active')">
            {{ 'BLACKLIST.ACTIVE' | translate }}
          </button>
          <button class="btn" [class.btn-primary]="viewMode === 'removed'" [class.btn-outline]="viewMode !== 'removed'" (click)="switchView('removed')">
            {{ 'BLACKLIST.REMOVED' | translate }}
          </button>
        </div>
        @if (viewMode === 'active') {
        <button class="btn btn-outline" *hasPermission="'blacklist.read'" (click)="exportData()" [disabled]="exporting">
          <i class="pi" [ngClass]="exporting ? 'pi-spin pi-spinner' : 'pi-file-excel'"></i> {{ 'COMMON.EXPORT' | translate }}
        </button>
        <button class="btn btn-primary" *hasPermission="'blacklist.create'" (click)="openDialog()">
          <i class="pi pi-plus"></i> {{ 'BLACKLIST.ADD_PERSON' | translate }}
        </button>
        }
      </div>
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
        [rowsPerPageOptions]="[10, 20, 50]"
        [globalFilterFields]="['firstName', 'lastName', 'idNumber', 'phoneNumber', 'reason']"
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
          </div>
        </ng-template>
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="firstName">{{ 'COMMON.NAME' | translate }} <p-sortIcon field="firstName" /> <p-columnFilter field="firstName" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="idNumber">{{ 'BLACKLIST.ID_NUMBER' | translate }} <p-sortIcon field="idNumber" /> <p-columnFilter field="idNumber" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="phoneNumber">{{ 'BLACKLIST.PHONE_NUMBER' | translate }} <p-sortIcon field="phoneNumber" /> <p-columnFilter field="phoneNumber" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="reason">{{ 'BLACKLIST.REASON' | translate }} <p-sortIcon field="reason" /> <p-columnFilter field="reason" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="blockedAt">{{ 'BLACKLIST.BLOCKED_AT' | translate }} <p-sortIcon field="blockedAt" /> <p-columnFilter field="blockedAt" type="date" display="menu"></p-columnFilter></th>
            <th pSortableColumn="blockedUntil">{{ 'BLACKLIST.BLOCKED_UNTIL' | translate }} <p-sortIcon field="blockedUntil" /> <p-columnFilter field="blockedUntil" type="date" display="menu"></p-columnFilter></th>
            <th pSortableColumn="createdByUser.firstName">{{ 'BLACKLIST.CREATED_BY' | translate }} <p-sortIcon field="createdByUser.firstName" /> <p-columnFilter field="createdByUser.firstName" type="text" display="menu"></p-columnFilter></th>
            <th>{{ 'BLACKLIST.NOTIFY_USERS' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-entry>
          <tr>
            <td class="name-cell">{{ entry.firstName }} {{ entry.lastName }}</td>
            <td>{{ entry.idNumber }}</td>
            <td>{{ entry.phoneNumber }}</td>
            <td>{{ entry.reason }}</td>
            <td dir="ltr">{{ entry.blockedAt | dateFormat }}</td>
            <td dir="ltr">{{ entry.blockedUntil ? (entry.blockedUntil | dateFormat) : ('BLACKLIST.PERMANENT' | translate) }}</td>
            <td>{{ getCreatedByName(entry) }}</td>
            <td>
              @if (entry.notifyUsers?.length) {
                <span class="notify-badge active" [pTooltip]="getNotifyTooltip(entry)" tooltipPosition="top">
                  <i class="pi pi-bell"></i>
                  <span class="notify-badge-count">{{ entry.notifyUsers.length }}</span>
                  <span class="notify-badge-label">{{ 'BLACKLIST.NOTIFY_ACTIVE' | translate }}</span>
                </span>
              } @else {
                <span class="notify-badge inactive" [pTooltip]="('BLACKLIST.NOTIFY_NONE' | translate)" tooltipPosition="top">
                  <i class="pi pi-bell-slash"></i>
                  <span class="notify-badge-label">{{ 'BLACKLIST.NOTIFY_OFF' | translate }}</span>
                </span>
              }
            </td>
            <td class="actions">
              @if (viewMode === 'active') {
              <button class="btn-icon" *hasPermission="'blacklist.update'" (click)="openDialog(entry)" [title]="'COMMON.EDIT' | translate">
                <i class="pi pi-pencil"></i>
              </button>
              <button class="btn-icon danger" *hasPermission="'blacklist.delete'" (click)="onDelete(entry)" [title]="'COMMON.DELETE' | translate">
                <i class="pi pi-trash"></i>
              </button>
              } @else {
              <button class="btn-icon success" *hasPermission="'blacklist.create'" (click)="onRestore(entry)" [title]="'BLACKLIST.RESTORE' | translate">
                <i class="pi pi-replay"></i>
              </button>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="9" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
        </ng-template>
      </p-table>

    <!-- Create / Edit Dialog -->
    <p-dialog [header]="editing ? ('BLACKLIST.EDIT_ENTRY' | translate) : ('BLACKLIST.ADD_PERSON' | translate)"
      [(visible)]="showDialog" (onHide)="onDialogHide()" [modal]="true" [style]="{width: '600px'}" [draggable]="false">
      @if (showDialog) {
      <div class="dialog-form">
        <!-- Person fields -->
        <div class="form-row">
          <div class="field"><label>{{ 'BLACKLIST.FIRST_NAME' | translate }} <span class="required">*</span></label>
            <input type="text" [(ngModel)]="form.firstName" required #firstNameField="ngModel" [placeholder]="'PLACEHOLDER.ENTER_FIRST_NAME' | translate" />
            @if (firstNameField.invalid && firstNameField.touched) {
              <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
            }
          </div>
          <div class="field"><label>{{ 'BLACKLIST.LAST_NAME' | translate }} <span class="required">*</span></label>
            <input type="text" [(ngModel)]="form.lastName" required #lastNameField="ngModel" [placeholder]="'PLACEHOLDER.ENTER_LAST_NAME' | translate" />
            @if (lastNameField.invalid && lastNameField.touched) {
              <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
            }
          </div>
        </div>

        <div class="form-row">
          <div class="field"><label>{{ 'BLACKLIST.ID_NUMBER' | translate }} <span class="required">*</span></label>
            <input type="text" [(ngModel)]="form.idNumber" required pattern="[0-9]*" #idNumberField="ngModel" [placeholder]="'PLACEHOLDER.ENTER_ID_NUMBER' | translate" />
            @if (idNumberField.errors?.['required'] && idNumberField.touched) {
              <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
            }
            @if (idNumberField.errors?.['pattern'] && idNumberField.touched) {
              <small class="field-error">{{ 'VALIDATION.DIGITS_ONLY' | translate }}</small>
            }
          </div>
          <div class="field"><label>{{ 'BLACKLIST.PHONE_NUMBER' | translate }}</label>
            <input type="text" [(ngModel)]="form.phoneNumber" [placeholder]="'PLACEHOLDER.ENTER_PHONE' | translate" />
          </div>
        </div>

        <div class="field"><label>{{ 'BLACKLIST.REASON' | translate }} <span class="required">*</span></label>
          <input type="text" [(ngModel)]="form.reason" required #reasonField="ngModel" [placeholder]="'PLACEHOLDER.ENTER_REASON' | translate" />
          @if (reasonField.invalid && reasonField.touched) {
            <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
          }
        </div>

        <div class="field"><label>{{ 'BLACKLIST.BLOCKED_UNTIL' | translate }}</label>
          <p-calendar [(ngModel)]="form.blockedUntil" [showIcon]="true" [minDate]="minBlockedUntilDate" dateFormat="dd/mm/yy" [showButtonBar]="true" [placeholder]="'BLACKLIST.PERMANENT' | translate" appendTo="body" [style]="{'width':'100%'}" />
        </div>

        <!-- Notification Section -->
        <div class="section-divider">
          <span class="section-label"><i class="pi pi-bell"></i> {{ 'BLACKLIST.NOTIFICATIONS' | translate }}</span>
        </div>

        <div class="field">
          <label>{{ 'BLACKLIST.NOTIFY_USERS' | translate }}</label>
          <p-multiSelect
            [(ngModel)]="selectedNotifyUserIds"
            [options]="allUsers"
            optionLabel="firstName"
            optionValue="id"
            [optionDisabled]="'_disabled'"
            [filter]="true"
            [filterBy]="'firstName,lastName,email,phone'"
            [placeholder]="'PLACEHOLDER.SEARCH_USERS' | translate"
            [emptyFilterMessage]="'COMMON.NO_DATA' | translate"
            [showToggleAll]="false"
            appendTo="body"
            display="chip"
            [style]="{'width':'100%'}"
            [panelStyle]="{'max-width':'560px'}"
            styleClass="notify-users-multiselect"
          >
            <ng-template let-user pTemplate="item">
              <div class="user-option" [class.user-disabled]="user._disabled">
                <div class="user-option-main">
                  <span class="user-option-name">{{ user.firstName }} {{ user.lastName }}</span>
                </div>
                <div class="user-option-details">
                  @if (user.email) {
                    <span class="user-detail"><i class="pi pi-envelope"></i> {{ user.email }}</span>
                  }
                  @if (user.phone) {
                    <span class="user-detail"><i class="pi pi-phone"></i> {{ user.phone }}</span>
                  }
                  @if (!user.email && !user.phone) {
                    <span class="user-detail user-detail-warn"><i class="pi pi-exclamation-circle"></i> {{ 'BLACKLIST.USER_NO_CONTACT' | translate }}</span>
                  }
                </div>
              </div>
            </ng-template>
            <ng-template let-user pTemplate="selectedItems">
              @if (selectedNotifyUserIds.length) {
                @for (uid of selectedNotifyUserIds; track uid) {
                  <div class="user-chip">
                    <span class="user-chip-name">{{ getUserName(uid) }}</span>
                  </div>
                }
              } @else {
                <span class="multiselect-placeholder">{{ 'PLACEHOLDER.SEARCH_USERS' | translate }}</span>
              }
            </ng-template>
          </p-multiSelect>
        </div>

        <div class="field"><label>{{ 'BLACKLIST.NOTES' | translate }}</label>
          <textarea [(ngModel)]="form.notes" rows="3" [placeholder]="'PLACEHOLDER.ENTER_NOTES' | translate"></textarea></div>
      </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="save()" [disabled]="!isFormValid() || saving">{{ 'COMMON.SAVE' | translate }}</button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host { display: block; }
    .table-card { padding: 0; overflow: hidden; }
    .table-header { display: flex; align-items: center; gap: 0.5rem; }
    .p-input-icon-left { position: relative; }
    .p-input-icon-left i { position: absolute; top: 50%; transform: translateY(-50%); inset-inline-start: 0.75rem; color: var(--color-text-muted, #9896ad); }
    .p-input-icon-left input { padding-inline-start: 2.25rem; }
    .name-cell { font-weight: 500; }
    .header-actions { display: flex; gap: 0.75rem; align-items: center; }
    .view-toggle { display: flex; gap: 0.25rem; }
    .view-toggle .btn { padding: 0.35rem 0.85rem; font-size: 0.82rem; }
    .actions { display: flex; gap: 0.3rem; align-items: center; }
    .btn-icon.success { color: #16a34a; }
    .btn-icon.success:hover { color: #15803d; background: rgba(22,163,74,0.08); }
    .empty { text-align: center; color: var(--color-text-muted); padding: 2rem !important; font-size: 0.88rem; }
    .text-muted { color: var(--color-text-muted); }
    .dialog-form { display: flex; flex-direction: column; gap: 1rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .dialog-form .field { display: flex; flex-direction: column; gap: 0.3rem; }
    .dialog-form .field label { font-weight: 500; font-size: 0.85rem; color: var(--color-text-secondary); }
    .notify-badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.7rem; border-radius: 999px; font-size: 0.78rem; font-weight: 500; cursor: default; transition: all 0.2s ease; }
    .notify-badge i { font-size: 0.8rem; }
    .notify-badge.active { background: rgba(34,197,94,0.10); color: #16a34a; }
    .notify-badge.active:hover { background: rgba(34,197,94,0.18); }
    .notify-badge.active .notify-badge-count { display: inline-flex; align-items: center; justify-content: center; min-width: 1.15rem; height: 1.15rem; border-radius: 50%; background: #16a34a; color: #fff; font-size: 0.7rem; font-weight: 700; }
    .notify-badge.inactive { background: rgba(156,163,175,0.10); color: #9ca3af; }
    .notify-badge.inactive:hover { background: rgba(156,163,175,0.18); }
    .notify-badge-label { font-size: 0.76rem; }
    .section-divider { border-top: 1.5px solid var(--color-border, #e4e2f0); padding-top: 0.75rem; margin-top: 0.25rem; }
    .section-label { display: flex; align-items: center; gap: 0.4rem; font-weight: 600; font-size: 0.85rem; color: var(--color-primary, #020140); }
    .section-label i { color: var(--color-accent, #6c63ff); font-size: 0.9rem; }
    .user-option { padding: 0.35rem 0; }
    .user-option-main { display: flex; align-items: center; gap: 0.4rem; }
    .user-option-name { font-weight: 600; font-size: 0.88rem; color: var(--color-text, #1a1a2e); }
    .user-option-details { display: flex; gap: 0.75rem; margin-top: 0.2rem; flex-wrap: wrap; }
    .user-disabled { opacity: 0.5; }
    .user-disabled .user-option-name { color: var(--color-text-muted, #9896ad); }
    .user-detail { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.78rem; color: var(--color-text-muted, #9896ad); }
    .user-detail i { font-size: 0.72rem; }
    .user-detail-warn { color: #d97706; font-style: italic; }
    .user-detail-warn i { color: #d97706; }
    .user-chip { display: inline-flex; align-items: center; gap: 0.3rem; background: var(--color-accent-subtle, #ddd9ff); color: var(--color-primary, #020140); border-radius: 999px; padding: 0.15rem 0.6rem; font-size: 0.82rem; margin: 0.1rem 0.15rem; }
    .user-chip-name { font-weight: 500; }
    .multiselect-placeholder { color: var(--color-text-muted, #9896ad); font-size: 0.9rem; }
    :host ::ng-deep .notify-users-multiselect .p-multiselect { width: 100%; min-height: 38px; border: 1.5px solid var(--color-border, #e4e2f0); border-radius: var(--radius-sm, 6px); transition: border-color 0.2s, box-shadow 0.2s; }
    :host ::ng-deep .notify-users-multiselect .p-multiselect:hover { border-color: var(--color-accent, #6c63ff); }
    :host ::ng-deep .notify-users-multiselect .p-multiselect.p-focus { border-color: var(--color-accent, #6c63ff); box-shadow: 0 0 0 3px rgba(108,99,255,0.12); }
    :host ::ng-deep .notify-users-multiselect .p-multiselect-label { padding: 0.35rem 0.5rem; display: flex; flex-wrap: wrap; gap: 0.2rem; align-items: center; }
    :host ::ng-deep .p-multiselect-panel { border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
    :host ::ng-deep .p-multiselect-panel .p-multiselect-item.p-disabled { opacity: 1; pointer-events: none; }
    :host ::ng-deep .p-multiselect-panel .p-multiselect-item.p-disabled .p-checkbox { opacity: 0.35; }
    :host ::ng-deep .p-multiselect-filter-container { padding: 0.5rem; }
  `],
})
export class BlacklistListComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotificationService);

  viewMode: 'active' | 'removed' = 'active';
  items: BlacklistEntry[] = [];
  totalRecords = 0;
  rows = 20;
  first = 0;
  sortField = 'blockedAt';
  sortOrder = -1;
  loading = false;
  saving = false;
  exporting = false;
  private lastLazyEvent: any = { first: 0, rows: 20, sortField: 'blockedAt', sortOrder: -1, filters: {} };

  showDialog = false;
  editing: BlacklistEntry | null = null;
  form = {
    firstName: '', lastName: '', idNumber: '', phoneNumber: '', reason: '',
    notes: '', blockedUntil: null as Date | null,
  };
  selectedNotifyUserIds: string[] = [];
  allUsers: any[] = [];
  minBlockedUntilDate = new Date();

  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private confirmService = inject(ConfirmService);

  ngOnInit(): void {
    this.loadData();
    this.loadAllUsers();
  }

  loadAllUsers(): void {
    this.api.get<PaginatedResult<User>>('/users', { limit: 100 }).subscribe((res) => {
      const users = res.items.map(u => ({
        ...u,
        _label: `${u.firstName} ${u.lastName}`,
        _disabled: !u.email && !u.phone,
      }));
      if (res.total > res.items.length) {
        const pages = Math.ceil(res.total / 100);
        for (let p = 2; p <= pages; p++) {
          this.api.get<PaginatedResult<User>>('/users', { page: p, limit: 100 }).subscribe((r) => {
            this.allUsers = [
              ...this.allUsers,
              ...r.items.map(u => ({
                ...u,
                _label: `${u.firstName} ${u.lastName}`,
                _disabled: !u.email && !u.phone,
              })),
            ];
          });
        }
      }
      this.allUsers = users;
    });
  }

  getUserName(uid: string): string {
    const u = this.allUsers.find(x => x.id === uid);
    return u ? u._label : uid;
  }

  getNotifyTooltip(entry: BlacklistEntry): string {
    if (!entry.notifyUsers?.length) return '';
    const names = entry.notifyUsers.map(u => `${u.firstName} ${u.lastName}`);
    return names.join('\n');
  }

  loadData(event: any = this.lastLazyEvent): void {
    this.loading = true;
    this.lastLazyEvent = event;
    this.first = event.first ?? 0;
    this.rows = event.rows ?? 20;
    this.sortField = event.sortField || 'blockedAt';
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

    const endpoint = this.viewMode === 'removed' ? '/visitors/blacklist/removed' : '/visitors/blacklist';
    this.api.get<PaginatedResult<BlacklistEntry>>(endpoint, params).subscribe((r) => {
      this.items = r.items;
      this.totalRecords = r.total;
      this.loading = false;
    });
  }

  onLazyLoad(event: any): void {
    this.loadData(event);
  }

  exportData(): void {
    this.exporting = true;
    const event = this.lastLazyEvent ?? {};
    const params: Record<string, string | number> = {
      sortBy: event.sortField || 'blockedAt',
      sortOrder: (event.sortOrder || -1) === 1 ? 'ASC' : 'DESC',
      filters: JSON.stringify(event.filters ?? {}),
    };
    const global = event.filters?.global?.value;
    if (global) params['search'] = global;

    this.api.download('/visitors/blacklist/export', params).subscribe({
      next: (blob) => {
        downloadBlob(blob, 'blacklist.xlsx');
        this.exporting = false;
      },
      error: (err) => { this.exporting = false; this.notify.error(err); },
    });
  }

  openDialog(entry?: BlacklistEntry): void {
    this.editing = entry ?? null;
    if (entry) {
      this.form = {
        firstName: entry.firstName ?? '',
        lastName: entry.lastName ?? '',
        idNumber: entry.idNumber ?? '',
        phoneNumber: entry.phoneNumber ?? '',
        reason: entry.reason,
        notes: entry.notes ?? '',
        blockedUntil: entry.blockedUntil ? new Date(entry.blockedUntil) : null,
      };
      this.selectedNotifyUserIds = entry.notifyUsers ? entry.notifyUsers.map(u => u.id) : [];
    } else {
      this.form = {
        firstName: '', lastName: '', idNumber: '', phoneNumber: '', reason: '',
        notes: '', blockedUntil: null,
      };
      this.selectedNotifyUserIds = [];
    }
    this.showDialog = true;
  }

  isFormValid(): boolean {
    if (!this.form.firstName || !this.form.lastName || !this.form.idNumber || !this.form.reason) return false;
    return true;
  }

  save(): void {
    if (!this.isFormValid()) return;
    this.saving = true;
    const body: any = {
      reason: this.form.reason,
      firstName: this.form.firstName,
      lastName: this.form.lastName,
      idNumber: this.form.idNumber,
      notifyUserIds: this.selectedNotifyUserIds,
    };
    if (this.form.phoneNumber) body.phoneNumber = this.form.phoneNumber;
    if (this.form.notes) body.notes = this.form.notes;
    body.blockedUntil = this.form.blockedUntil ? this.form.blockedUntil.toISOString() : null;

    const req$ = this.editing
      ? this.api.patch(`/visitors/blacklist/${this.editing.id}`, body)
      : this.api.post('/visitors/blacklist', body);
    req$.subscribe({
      next: () => { this.saving = false; this.showDialog = false; this.notify.success('COMMON.SUCCESS'); this.loadData(); },
      error: (err) => { this.saving = false; this.notify.error(err); },
    });
  }

  async onDelete(entry: BlacklistEntry): Promise<void> {
    const displayName = entry.firstName + ' ' + entry.lastName;
    if (await this.confirmService.confirm('BLACKLIST.DELETE_CONFIRM')) {
      this.api.delete(`/visitors/blacklist/${entry.id}`).subscribe({
        next: () => { this.notify.success('COMMON.SUCCESS'); this.loadData(); },
        error: (err) => this.notify.error(err),
      });
    }
  }

  switchView(mode: 'active' | 'removed'): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.first = 0;
    this.lastLazyEvent = { ...this.lastLazyEvent, first: 0 };
    this.loadData();
  }

  async onRestore(entry: BlacklistEntry): Promise<void> {
    if (await this.confirmService.confirm('BLACKLIST.RESTORE_CONFIRM')) {
      this.api.patch(`/visitors/blacklist/${entry.id}/restore`, {}).subscribe({
        next: () => { this.notify.success('COMMON.SUCCESS'); this.loadData(); },
        error: (err) => this.notify.error(err),
      });
    }
  }

  onDialogHide(): void {
    this.form = {
      firstName: '', lastName: '', idNumber: '', phoneNumber: '', reason: '',
      notes: '', blockedUntil: null,
    };
    this.editing = null;
    this.selectedNotifyUserIds = [];
  }

  getCreatedByName(entry: BlacklistEntry): string {
    if (entry.createdByUser) {
      return `${entry.createdByUser.firstName} ${entry.createdByUser.lastName}`;
    }
    return '-';
  }
}
