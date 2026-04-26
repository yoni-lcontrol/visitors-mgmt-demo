import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { AccessControlApiService, AccessLevelImportResult } from '../../services/access-control-api.service';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { UserWebSocketService } from '@core/websocket/user-websocket.service';
import { WsEvent } from '@core/websocket/ws-events.enum';
import { AccessLevel } from '@core/models/entities.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-access-level-list',
  standalone: true,
  imports: [TranslateModule, FormsModule, HasPermissionDirective, TableModule, InputTextModule, DialogModule, ProgressBarModule],
  template: `
    <div class="page-header">
      <h1>{{ 'ACCESS_CONTROL.ACCESS_LEVELS' | translate }}</h1>
      <div class="header-actions">
        <button class="btn btn-secondary" *hasPermission="'access-control.import'" (click)="doImport()" [disabled]="importing">
          <i class="pi pi-cloud-download"></i>
          {{ importing ? ('ACCESS_CONTROL.IMPORTING' | translate) : ('COMMON.IMPORT' | translate) }}
        </button>
        <button class="btn btn-primary" *hasPermission="'access-control.create'" (click)="openDialog()">
          <i class="pi pi-plus"></i> {{ 'ACCESS_CONTROL.ADD_ACCESS_LEVEL' | translate }}
        </button>
      </div>
    </div>
    @if (importing) {
      <div class="import-progress-container">
        <p-progressBar [value]="importProgress" [showValue]="true"></p-progressBar>
        <span class="import-progress-text">{{ importProgressMessage }}</span>
      </div>
    }
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
        [globalFilterFields]="['name']"
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
            <th pSortableColumn="name">{{ 'ACCESS_CONTROL.ACCESS_LEVEL_NAME' | translate }} <p-sortIcon field="name" /> <p-columnFilter field="name" type="text" display="menu"></p-columnFilter></th>
            <th>{{ 'COMMON.ACTIVE' | translate }}</th>
            <th>{{ 'ACCESS_CONTROL.VISITOR_ACCESS' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-al>
          <tr>
            <td class="name-cell">{{ al.name }}</td>
            <td>
              <span class="status-badge" [class.active]="al.active" [class.inactive]="!al.active">
                <i class="pi" [class.pi-check-circle]="al.active" [class.pi-times-circle]="!al.active"></i>
                {{ (al.active ? 'COMMON.YES' : 'COMMON.NO') | translate }}
              </span>
            </td>
            <td>
              <span class="status-badge" [class.active]="al.visitorAccess" [class.inactive]="!al.visitorAccess">
                <i class="pi" [class.pi-check-circle]="al.visitorAccess" [class.pi-times-circle]="!al.visitorAccess"></i>
                {{ (al.visitorAccess ? 'COMMON.YES' : 'COMMON.NO') | translate }}
              </span>
            </td>
            <td class="actions">
              <button class="btn-icon" *hasPermission="'access-control.update'" (click)="openDialog(al)" [title]="'COMMON.EDIT' | translate">
                <i class="pi pi-pencil"></i>
              </button>
              <button class="btn-icon danger" *hasPermission="'access-control.delete'" (click)="onDelete(al)" [title]="'COMMON.DELETE' | translate">
                <i class="pi pi-trash"></i>
              </button>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="4" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Create / Edit Dialog -->
    <p-dialog [header]="editing ? ('ACCESS_CONTROL.EDIT_ACCESS_LEVEL' | translate) : ('ACCESS_CONTROL.ADD_ACCESS_LEVEL' | translate)"
      [(visible)]="showDialog" (onHide)="onDialogHide()" [modal]="true" [style]="{width: '480px'}" [draggable]="false">
      @if (showDialog) {
      <div class="dialog-form">
        <div class="field"><label>{{ 'ACCESS_CONTROL.ACCESS_LEVEL_NAME' | translate }} <span class="required">*</span></label>
          <input type="text" [(ngModel)]="form.name" required #nameField="ngModel" [placeholder]="'PLACEHOLDER.ENTER_ACCESS_LEVEL_NAME' | translate" />
          @if (nameField.invalid && nameField.touched) {
            <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
          }
        </div>
        <div class="field">
          <label>{{ 'COMMON.ACTIVE' | translate }}</label>
          <div class="toggle-group">
            <button type="button" class="toggle-btn" [class.active]="form.active" (click)="form.active = true">
              <i class="pi pi-check-circle"></i> {{ 'COMMON.YES' | translate }}
            </button>
            <button type="button" class="toggle-btn" [class.inactive]="!form.active" (click)="form.active = false">
              <i class="pi pi-times-circle"></i> {{ 'COMMON.NO' | translate }}
            </button>
          </div>
        </div>
        <div class="field">
          <label>{{ 'ACCESS_CONTROL.VISITOR_ACCESS' | translate }}</label>
          <div class="toggle-group">
            <button type="button" class="toggle-btn" [class.active]="form.visitorAccess" (click)="form.visitorAccess = true">
              <i class="pi pi-check-circle"></i> {{ 'COMMON.YES' | translate }}
            </button>
            <button type="button" class="toggle-btn" [class.inactive]="!form.visitorAccess" (click)="form.visitorAccess = false">
              <i class="pi pi-times-circle"></i> {{ 'COMMON.NO' | translate }}
            </button>
          </div>
        </div>
      </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="save()" [disabled]="!form.name || saving">{{ 'COMMON.SAVE' | translate }}</button>
      </ng-template>
    </p-dialog>

    <!-- Import Results Dialog -->
    <p-dialog [header]="'ACCESS_CONTROL.IMPORT_RESULTS' | translate"
      [(visible)]="showImportResults" [modal]="true" [style]="{width: '680px'}" [draggable]="false">
      @if (showImportResults && importResult) {
        <div class="import-summary">
          <span class="import-stat success"><i class="pi pi-plus-circle"></i> {{ 'ACCESS_CONTROL.CREATED' | translate }}: {{ importResult.created }}</span>
          <span class="import-stat info"><i class="pi pi-refresh"></i> {{ 'ACCESS_CONTROL.UPDATED' | translate }}: {{ importResult.updated }}</span>
          <span class="import-stat warn"><i class="pi pi-exclamation-circle"></i> {{ 'ACCESS_CONTROL.SKIPPED' | translate }}: {{ importResult.skipped }}</span>
        </div>
        @if (importResult.items.length > 0) {
          <p-table [value]="importResult.items" [paginator]="importResult.items.length > 10" [rows]="10"
            styleClass="p-datatable-sm p-datatable-striped" [scrollable]="true" scrollHeight="350px">
            <ng-template pTemplate="header">
              <tr>
                <th>{{ 'ACCESS_CONTROL.ACCESS_LEVEL_NAME' | translate }}</th>
                <th>{{ 'COMMON.ACTIVE' | translate }}</th>
                <th>{{ 'ACCESS_CONTROL.VISITOR_ACCESS' | translate }}</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-item>
              <tr>
                <td>{{ item.name }}</td>
                <td>
                  <span class="status-badge" [class.active]="item.active" [class.inactive]="!item.active">
                    <i class="pi" [class.pi-check-circle]="item.active" [class.pi-times-circle]="!item.active"></i>
                    {{ (item.active ? 'COMMON.YES' : 'COMMON.NO') | translate }}
                  </span>
                </td>
                <td>
                  <span class="status-badge" [class.active]="item.visitorAccess" [class.inactive]="!item.visitorAccess">
                    <i class="pi" [class.pi-check-circle]="item.visitorAccess" [class.pi-times-circle]="!item.visitorAccess"></i>
                    {{ (item.visitorAccess ? 'COMMON.YES' : 'COMMON.NO') | translate }}
                  </span>
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-primary" (click)="showImportResults = false">{{ 'COMMON.CLOSE' | translate }}</button>
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
    .header-actions { display: flex; gap: 0.5rem; }
    .actions { display: flex; gap: 0.3rem; align-items: center; }
    .empty { text-align: center; color: var(--color-text-muted); padding: 2rem !important; font-size: 0.88rem; }
    .dialog-form { display: flex; flex-direction: column; gap: 1rem; }
    .dialog-form .field { display: flex; flex-direction: column; gap: 0.3rem; }
    .dialog-form .field label { font-weight: 500; font-size: 0.85rem; color: var(--color-text-secondary); }

    .status-badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.7rem; border-radius: 999px; font-size: 0.8rem; font-weight: 500; letter-spacing: 0.01em; }
    .status-badge.active { background: rgba(34,197,94,0.12); color: #16a34a; }
    .status-badge.inactive { background: rgba(239,68,68,0.10); color: #dc2626; }
    .status-badge i { font-size: 0.85rem; }
    .toggle-group { display: flex; gap: 0.5rem; }
    .toggle-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 1rem; border-radius: 999px; font-size: 0.85rem; font-weight: 500; border: 1.5px solid var(--color-border, #e0dfe6); background: var(--color-surface, #fff); color: var(--color-text-muted, #9896ad); cursor: pointer; transition: all 0.2s ease; }
    .toggle-btn:hover { border-color: var(--color-text-secondary, #6b7280); }
    .toggle-btn.active { background: rgba(34,197,94,0.12); color: #16a34a; border-color: #16a34a; }
    .toggle-btn.inactive { background: rgba(239,68,68,0.10); color: #dc2626; border-color: #dc2626; }
    .toggle-btn i { font-size: 0.9rem; }
    .import-progress-container { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .import-progress-text { font-size: 0.85rem; color: var(--color-text-secondary, #6b7280); }
    .import-summary { display: flex; gap: 1.5rem; margin-bottom: 1rem; }
    .import-stat { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; font-weight: 500; }
    .import-stat.success { color: #16a34a; }
    .import-stat.info { color: #2563eb; }
    .import-stat.warn { color: #d97706; }
    .import-stat i { font-size: 1rem; }
  `],
})
export class AccessLevelListComponent implements OnInit, OnDestroy {
  private acApi = inject(AccessControlApiService);
  private notify = inject(NotificationService);
  private confirmService = inject(ConfirmService);
  private userWs = inject(UserWebSocketService);
  router = inject(Router);

  items: AccessLevel[] = [];
  totalRecords = 0;
  rows = 20;
  first = 0;
  sortField = 'name';
  sortOrder = 1;
  loading = false;
  importing = false;
  saving = false;
  private lastLazyEvent: any = { first: 0, rows: 20, sortField: 'name', sortOrder: 1, filters: {} };

  // Import progress
  importProgress = 0;
  importProgressMessage = '';
  importResult: AccessLevelImportResult | null = null;
  showImportResults = false;
  private wsSubs: Subscription[] = [];

  // Dialog
  showDialog = false;
  editing: AccessLevel | null = null;
  form = { name: '', active: true, visitorAccess: false };

  ngOnInit(): void {
    this.loadData();
    this.subscribeToImportEvents();
  }

  ngOnDestroy(): void {
    this.wsSubs.forEach((s) => s.unsubscribe());
    this.wsSubs = [];
  }

  private subscribeToImportEvents(): void {
    this.wsSubs.push(
      this.userWs.on<{ phase: string; message: string; current: number; total: number }>(
        WsEvent.AccessControlAccessLevelsImportProgress,
      ).subscribe((data) => {
        this.importProgressMessage = data.message;
        this.importProgress = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
      }),
    );
  }

  loadData(event: any = this.lastLazyEvent): void {
    this.loading = true;
    this.lastLazyEvent = event;
    this.first = event.first ?? 0;
    this.rows = event.rows ?? 20;
    this.sortField = event.sortField || 'name';
    this.sortOrder = event.sortOrder || 1;

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

    this.acApi.getAccessLevels(params).subscribe((r) => {
      this.items = r.items;
      this.totalRecords = r.total;
      this.loading = false;
    });
  }

  onLazyLoad(event: any): void {
    this.loadData(event);
  }

  openDialog(al?: AccessLevel): void {
    this.editing = al ?? null;
    this.form = al
      ? { name: al.name, active: al.active, visitorAccess: al.visitorAccess }
      : { name: '', active: true, visitorAccess: false };
    this.showDialog = true;
  }

  save(): void {
    this.saving = true;
    const req$ = this.editing
      ? this.acApi.updateAccessLevel(this.editing.id, this.form)
      : this.acApi.createAccessLevel(this.form);
    req$.subscribe({
      next: () => { this.saving = false; this.showDialog = false; this.notify.success('COMMON.SUCCESS'); this.loadData(); },
      error: (err) => { this.saving = false; this.notify.error(err); },
    });
  }

  async onDelete(al: AccessLevel): Promise<void> {
    if (await this.confirmService.confirm('ACCESS_CONTROL.DELETE_ACCESS_LEVEL_CONFIRM', { name: al.name })) {
      this.acApi.deleteAccessLevel(al.id).subscribe({
        next: () => { this.notify.success('COMMON.SUCCESS'); this.loadData(); },
        error: (err) => this.notify.error(err),
      });
    }
  }

  doImport(): void {
    this.importing = true;
    this.importProgress = 0;
    this.importProgressMessage = '';
    this.importResult = null;
    this.acApi.importAccessLevels().subscribe({
      next: (result) => {
        this.importing = false;
        this.importProgress = 100;
        this.importResult = result;
        this.showImportResults = true;
        this.notify.success('ACCESS_CONTROL.IMPORT_TRIGGERED');
        this.loadData();
      },
      error: (err) => {
        this.importing = false;
        this.importProgress = 0;
        this.importProgressMessage = '';
        this.notify.error(err);
      },
    });
  }

  onDialogHide(): void {
    this.form = { name: '', active: true, visitorAccess: false };
    this.editing = null;
  }
}
