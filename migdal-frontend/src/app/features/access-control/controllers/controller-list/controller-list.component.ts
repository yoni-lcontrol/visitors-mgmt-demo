import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { AccessControlApiService, ControllerImportResult } from '../../services/access-control-api.service';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { UserWebSocketService } from '@core/websocket/user-websocket.service';
import { WsEvent } from '@core/websocket/ws-events.enum';
import { downloadBlob } from '@core/utils/download.util';
import { AcController } from '@core/models/entities.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-controller-list',
  standalone: true,
  imports: [TranslateModule, FormsModule, ReactiveFormsModule, HasPermissionDirective, TableModule, InputTextModule, InputSwitchModule, DialogModule, ProgressBarModule],
  template: `
    <div class="page-header">
      <h1>{{ 'ACCESS_CONTROL.CONTROLLERS' | translate }}</h1>
      <div class="header-actions">
        <button class="btn btn-secondary" *hasPermission="'access-control.read'" (click)="exportData()"><i class="pi pi-file-excel"></i> {{ 'COMMON.EXPORT' | translate }}</button>
        <button class="btn btn-secondary" *hasPermission="'access-control.import'" (click)="doImport()" [disabled]="importing">
          <i class="pi pi-cloud-download"></i>
          {{ importing ? ('ACCESS_CONTROL.IMPORTING' | translate) : ('COMMON.IMPORT' | translate) }}
        </button>
        <button class="btn btn-primary" *hasPermission="'access-control.create'" (click)="openDialog()">
          <i class="pi pi-plus"></i> {{ 'ACCESS_CONTROL.ADD_CONTROLLER' | translate }}
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
        [value]="controllers"
        [lazy]="true"
        (onLazyLoad)="onLazyLoad($event)"
        [loading]="loading"
        [totalRecords]="totalRecords"
        [paginator]="true"
        [rows]="rows"
        [first]="first"
        [showCurrentPageReport]="true"
        [rowsPerPageOptions]="[10, 20, 50]"
        [globalFilterFields]="['name', 'ip', 'model', 'type', 'port']"
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
            <th pSortableColumn="name">{{ 'ACCESS_CONTROL.CONTROLLER_NAME' | translate }} <p-sortIcon field="name" /> <p-columnFilter field="name" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="type">{{ 'ACCESS_CONTROL.TYPE' | translate }} <p-sortIcon field="type" /> <p-columnFilter field="type" type="numeric" display="menu"></p-columnFilter></th>
            <th pSortableColumn="model">{{ 'ACCESS_CONTROL.MODEL' | translate }} <p-sortIcon field="model" /> <p-columnFilter field="model" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="ip">{{ 'ACCESS_CONTROL.IP_ADDRESS' | translate }} <p-sortIcon field="ip" /> <p-columnFilter field="ip" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="port">{{ 'ACCESS_CONTROL.PORT' | translate }} <p-sortIcon field="port" /> <p-columnFilter field="port" type="numeric" display="menu"></p-columnFilter></th>
            <th>{{ 'COMMON.ACTIVE' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-ctrl>
          <tr>
            <td class="name-cell"><a class="ctrl-link" (click)="router.navigate(['/access-control/controllers', ctrl.id])">{{ ctrl.name }}</a></td>
            <td>{{ ctrl.type }}</td>
            <td>{{ ctrl.model ?? '-' }}</td>
            <td><code>{{ ctrl.ip ?? '-' }}</code></td>
            <td>{{ ctrl.port }}</td>
            <td>
              <p-inputSwitch [(ngModel)]="ctrl.isActive" (onChange)="toggleActive(ctrl)"></p-inputSwitch>
            </td>
            <td class="actions">
              <button class="btn-icon" (click)="router.navigate(['/access-control/controllers', ctrl.id])" [title]="'ACCESS_CONTROL.VIEW_CONTROLLER' | translate">
                <i class="pi pi-eye"></i>
              </button>
              <button class="btn-icon" *hasPermission="'access-control.update'" (click)="openDialog(ctrl)" [title]="'COMMON.EDIT' | translate">
                <i class="pi pi-pencil"></i>
              </button>
              <button class="btn-icon danger" *hasPermission="'access-control.delete'" (click)="onDelete(ctrl)" [title]="'COMMON.DELETE' | translate">
                <i class="pi pi-trash"></i>
              </button>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="7" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
        </ng-template>
      </p-table>
    </div>
    <!-- Create / Edit Dialog -->
    <p-dialog [header]="editingController ? ('ACCESS_CONTROL.EDIT_CONTROLLER' | translate) : ('ACCESS_CONTROL.ADD_CONTROLLER' | translate)"
      [(visible)]="showDialog" (onHide)="onDialogHide()" [modal]="true" [style]="{width: '580px'}" [draggable]="false">
      @if (showDialog) {
        @if (dialogLoading) {
          <div class="loading">{{ 'COMMON.LOADING' | translate }}</div>
        } @else {
        <form [formGroup]="dialogForm" (ngSubmit)="saveDialog()">
          <div class="dialog-form-grid">
          <div class="field">
            <label>{{ 'ACCESS_CONTROL.CONTROLLER_NAME' | translate }} <span class="required">*</span></label>
            <input type="text" formControlName="name" [placeholder]="'PLACEHOLDER.ENTER_CONTROLLER_NAME' | translate" />
            @if (dialogForm.get('name')?.hasError('required') && dialogForm.get('name')?.touched) {
              <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
            }
          </div>
          <div class="field">
            <label>{{ 'ACCESS_CONTROL.TYPE' | translate }}</label>
            <input type="number" formControlName="type" [placeholder]="'PLACEHOLDER.ENTER_TYPE' | translate" />
          </div>
          <div class="field">
            <label>{{ 'ACCESS_CONTROL.MODEL' | translate }}</label>
            <input type="text" formControlName="model" [placeholder]="'PLACEHOLDER.ENTER_MODEL' | translate" />
          </div>
          <div class="field">
            <label>{{ 'ACCESS_CONTROL.IP_ADDRESS' | translate }}</label>
            <input type="text" formControlName="ip" [placeholder]="'PLACEHOLDER.ENTER_IP_ADDRESS' | translate" />
          </div>
          <div class="field">
            <label>{{ 'ACCESS_CONTROL.PORT' | translate }}</label>
            <input type="number" formControlName="port" [placeholder]="'PLACEHOLDER.ENTER_PORT' | translate" />
          </div>
          <div class="field">
            <label>{{ 'ACCESS_CONTROL.EXTERNAL_ID' | translate }}</label>
            <input type="text" formControlName="externalId" [placeholder]="'PLACEHOLDER.ENTER_EXTERNAL_ID' | translate" />
          </div>
          </div>
        </form>
        }
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="saveDialog()" [disabled]="dialogForm.invalid || saving">{{ 'COMMON.SAVE' | translate }}</button>
      </ng-template>
    </p-dialog>

    <!-- Import Results Dialog -->
    <p-dialog [header]="'ACCESS_CONTROL.IMPORT_RESULTS' | translate"
      [(visible)]="showImportResults" [modal]="true" [style]="{width: '780px'}" [draggable]="false">
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
                <th>{{ 'ACCESS_CONTROL.CONTROLLER_NAME' | translate }}</th>
                <th>{{ 'ACCESS_CONTROL.TYPE' | translate }}</th>
                <th>{{ 'ACCESS_CONTROL.MODEL' | translate }}</th>
                <th>{{ 'ACCESS_CONTROL.IP_ADDRESS' | translate }}</th>
                <th>{{ 'ACCESS_CONTROL.PORT' | translate }}</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-item>
              <tr>
                <td>{{ item.name }}</td>
                <td>{{ item.type ?? '-' }}</td>
                <td>{{ item.model ?? '-' }}</td>
                <td><code>{{ item.ip ?? '-' }}</code></td>
                <td>{{ item.port ?? '-' }}</td>
              </tr>
            </ng-template>
          </p-table>
        }
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-primary" (click)="showImportResults = false">{{ 'COMMON.CLOSE' | translate }}</button>
      </ng-template>
    </p-dialog>  `,
  styles: [`
      :host { display: block; }
      .table-card { padding: 0; overflow: hidden; }
      .table-header { display: flex; align-items: center; gap: 0.5rem; }
      .p-input-icon-left { position: relative; }
      .p-input-icon-left i { position: absolute; top: 50%; transform: translateY(-50%); inset-inline-start: 0.75rem; color: var(--color-text-muted, #9896ad); }
      .p-input-icon-left input { padding-inline-start: 2.25rem; }
      .filter-input { width: 100%; padding: 0.4rem 0.65rem; font-size: 0.82rem; }
      .name-cell { font-weight: 500; }
      code { background: var(--color-primary-wash, #eeedf8); padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.85rem; color: var(--color-primary, #020140); }

      .header-actions { display: flex; gap: 0.5rem; }
      .actions { display: flex; gap: 0.3rem; align-items: center; }
      .ctrl-link { color: var(--color-accent, #6c63ff); cursor: pointer; font-weight: 500; transition: color 0.2s; }
      .ctrl-link:hover { color: var(--color-accent-hover, #5a52e0); text-decoration: underline; }
      .dialog-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.15rem; }
      .dialog-form-grid .field { display: flex; flex-direction: column; }
      .dialog-form-grid .field label { font-weight: 500; margin-bottom: 0.3rem; font-size: 0.85rem; color: var(--color-text-secondary, #5c5a78); }
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
export class ControllerListComponent implements OnInit, OnDestroy {
  private acApi = inject(AccessControlApiService);
  private notify = inject(NotificationService);
  private fb = inject(FormBuilder);
  private confirmService = inject(ConfirmService);
  private userWs = inject(UserWebSocketService);
  router = inject(Router);
  controllers: AcController[] = [];
  totalRecords = 0;
  rows = 20;
  first = 0;
  sortField = 'name';
  sortOrder = 1;
  loading = false;
  importing = false;
  private lastLazyEvent: any = { first: 0, rows: 20, sortField: 'name', sortOrder: 1, filters: {} };

  // Import progress
  importProgress = 0;
  importProgressMessage = '';
  importResult: ControllerImportResult | null = null;
  showImportResults = false;
  private wsSubs: Subscription[] = [];

  // Dialog
  showDialog = false;
  editingController: AcController | null = null;
  dialogForm: FormGroup = new FormGroup({});
  saving = false;
  dialogLoading = false;

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
        WsEvent.AccessControlControllersImportProgress,
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

    this.acApi.getControllers(params).subscribe((r) => {
      this.controllers = r.items;
      this.totalRecords = r.total;
      this.loading = false;
    });
  }

  onLazyLoad(event: any): void {
    this.loadData(event);
  }

  exportData(): void {
    const event = this.lastLazyEvent ?? {};
    const params: Record<string, string | number> = {
      sortBy: event.sortField || 'name',
      sortOrder: (event.sortOrder || 1) === 1 ? 'ASC' : 'DESC',
      filters: JSON.stringify(event.filters ?? {}),
    };
    const global = event.filters?.global?.value;
    if (global) params['search'] = global;

    this.acApi.exportControllers(params).subscribe((blob) => {
      downloadBlob(blob, 'controllers.xlsx');
    });
  }

  async onDelete(ctrl: AcController): Promise<void> {
    if (await this.confirmService.confirm('ACCESS_CONTROL.DELETE_CONFIRM')) {
      this.acApi.deleteController(ctrl.id).subscribe({
        next: () => {
          this.notify.success('COMMON.SUCCESS');
          this.loadData();
        },
        error: (err) => this.notify.error(err),
      });
    }
  }

  doImport(): void {
    this.importing = true;
    this.importProgress = 0;
    this.importProgressMessage = '';
    this.importResult = null;
    this.acApi.importControllers().subscribe({
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

  toggleActive(ctrl: AcController): void {
    this.acApi.updateController(ctrl.id, { isActive: ctrl.isActive }).subscribe({
      next: () => this.notify.success('COMMON.SUCCESS'),
      error: (err) => {
        ctrl.isActive = !ctrl.isActive;
        this.notify.error(err);
      },
    });
  }

  openDialog(ctrl?: AcController): void {
    this.editingController = ctrl ?? null;
    this.dialogForm = this.fb.group({
      name: ['', Validators.required],
      type: [0],
      model: [''],
      ip: [''],
      port: [0],
      externalId: [''],
    });
    if (ctrl) {
      this.dialogLoading = true;
      this.acApi.getControllerById(ctrl.id).subscribe((c) => {
        this.dialogForm.patchValue({
          name: c.name,
          type: c.type ?? 0,
          model: c.model ?? '',
          ip: c.ip ?? '',
          port: c.port ?? 0,
          externalId: c.externalId ?? '',
        });
        this.dialogLoading = false;
      });
    }
    this.showDialog = true;
  }

  saveDialog(): void {
    if (this.dialogForm.invalid) return;
    this.saving = true;
    const req$ = this.editingController
      ? this.acApi.updateController(this.editingController.id, this.dialogForm.value)
      : this.acApi.createController(this.dialogForm.value);
    req$.subscribe({
      next: () => { this.saving = false; this.showDialog = false; this.notify.success('COMMON.SUCCESS'); this.loadData(); },
      error: (err) => { this.saving = false; this.notify.error(err); },
    });
  }

  onDialogHide(): void {
    this.dialogForm.reset();
    this.dialogForm.markAsPristine();
    this.dialogForm.markAsUntouched();
  }
}
