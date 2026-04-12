import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { UsersApiService } from '../services/users-api.service';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { downloadBlob } from '@core/utils/download.util';
import { User, Role } from '@core/models/entities.model';
import { EMAIL_PATTERN, DIGITS_ONLY_PATTERN } from '@shared/constants/regex.constants';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [TranslateModule, FormsModule, ReactiveFormsModule, HasPermissionDirective, TableModule, InputTextModule, InputSwitchModule, DialogModule],
  template: `
    <div class="page-header">
      <h1>{{ 'USERS.TITLE' | translate }}</h1>
      <div class="header-actions">
        <button class="btn btn-secondary" *hasPermission="'users.read'" (click)="exportData()"><i class="pi pi-file-excel"></i> {{ 'COMMON.EXPORT' | translate }}</button>
        <button class="btn btn-secondary" *hasPermission="'users.sync'" (click)="syncFromAd()" [disabled]="syncing">
          <i class="pi" [class.pi-spin]="syncing" [class.pi-spinner]="syncing" [class.pi-sync]="!syncing"></i> {{ 'USERS.SYNC_AD' | translate }}
        </button>
        <button class="btn btn-primary" *hasPermission="'users.create'" (click)="openDialog()">
          <i class="pi pi-plus"></i> {{ 'USERS.ADD_USER' | translate }}
        </button>
      </div>
    </div>
    <div class="card table-card">
      <p-table
        #dt
        [value]="users"
        [lazy]="true"
        (onLazyLoad)="onLazyLoad($event)"
        [loading]="loading"
        [totalRecords]="totalRecords"
        [paginator]="true"
        [rows]="rows"
        [first]="first"
        [showCurrentPageReport]="true"
        [rowsPerPageOptions]="[10, 25, 50]"
        [globalFilterFields]="['firstName', 'lastName', 'username', 'email', 'phone', 'isActive']"
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
            <th pSortableColumn="firstName">{{ 'USERS.FIRST_NAME' | translate }} <p-sortIcon field="firstName" /> <p-columnFilter field="firstName" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="lastName">{{ 'USERS.LAST_NAME' | translate }} <p-sortIcon field="lastName" /> <p-columnFilter field="lastName" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="username">{{ 'USERS.USERNAME' | translate }} <p-sortIcon field="username" /> <p-columnFilter field="username" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="email">{{ 'USERS.EMAIL' | translate }} <p-sortIcon field="email" /> <p-columnFilter field="email" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="phone">{{ 'USERS.PHONE' | translate }} <p-sortIcon field="phone" /> <p-columnFilter field="phone" type="text" display="menu"></p-columnFilter></th>
            <th>{{ 'USERS.ID_NUMBER' | translate }} </th>
            <th>{{ 'USERS.ROLES' | translate }} </th>
            <th>{{ 'COMMON.ACTIVE' | translate }} <p-columnFilter field="isActive" type="text" display="menu"></p-columnFilter></th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-user>
          <tr>
            <td>{{ user.firstName }}</td>
            <td>{{ user.lastName }}</td>
            <td>{{ user.username }}</td>
            <td>{{ user.email ?? '-' }}</td>
            <td>{{ user.phone ?? '-' }}</td>
            <td>{{ user.idNumber ?? '-' }}</td>
            <td>
              @for (role of user.roles; track role.id) {
                <span class="role-chip">{{ role.name }}</span>
              }
            </td>
            <td>
              <p-inputSwitch [(ngModel)]="user.isActive" (onChange)="onToggleActive(user)"></p-inputSwitch>
            </td>
            <td class="actions">
              <button class="btn-icon" *hasPermission="'users.update'" (click)="openDialog(user)" [title]="'COMMON.EDIT' | translate">
                <i class="pi pi-pencil"></i>
              </button>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="9" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
        </ng-template>
      </p-table>
    </div>
    <!-- Create / Edit Dialog -->
    <p-dialog [header]="editingUser ? ('USERS.EDIT_USER' | translate) : ('USERS.ADD_USER' | translate)"
      [(visible)]="showDialog" (onHide)="onDialogHide()" [modal]="true" [style]="{width: '580px'}" [draggable]="false">
      @if (showDialog) {
        @if (dialogLoading) {
          <div class="loading">{{ 'COMMON.LOADING' | translate }}</div>
        } @else {
        <form [formGroup]="dialogForm" (ngSubmit)="saveDialog()">
          <div class="dialog-form-grid">
          <div class="field">
            <label>{{ 'USERS.FIRST_NAME' | translate }} <span class="required">*</span></label>
            <input type="text" formControlName="firstName" [placeholder]="'PLACEHOLDER.ENTER_FIRST_NAME' | translate" />
            @if (dialogForm.get('firstName')?.hasError('required') && dialogForm.get('firstName')?.touched) {
              <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
            }
          </div>
          <div class="field">
            <label>{{ 'USERS.LAST_NAME' | translate }} <span class="required">*</span></label>
            <input type="text" formControlName="lastName" [placeholder]="'PLACEHOLDER.ENTER_LAST_NAME' | translate" />
            @if (dialogForm.get('lastName')?.hasError('required') && dialogForm.get('lastName')?.touched) {
              <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
            }
          </div>
          <div class="field">
            <label>{{ 'USERS.USERNAME' | translate }} <span class="required">*</span></label>
            <input type="text" formControlName="username" [placeholder]="'PLACEHOLDER.ENTER_USERNAME' | translate" />
            @if (dialogForm.get('username')?.hasError('required') && dialogForm.get('username')?.touched) {
              <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
            }
          </div>
          <div class="field">
            <label>{{ 'USERS.EMAIL' | translate }}</label>
            <input type="email" formControlName="email" [placeholder]="'PLACEHOLDER.ENTER_EMAIL' | translate" />
            @if (dialogForm.get('email')?.hasError('pattern') && dialogForm.get('email')?.touched) {
              <small class="field-error">{{ 'VALIDATION.EMAIL' | translate }}</small>
            }
          </div>
          <div class="field">
            <label>{{ 'USERS.PHONE' | translate }}</label>
            <input type="tel" formControlName="phone" [placeholder]="'PLACEHOLDER.ENTER_PHONE' | translate" />
            @if (dialogForm.get('phone')?.hasError('pattern') && dialogForm.get('phone')?.touched) {
              <small class="field-error">{{ 'VALIDATION.DIGITS_ONLY' | translate }}</small>
            }
          </div>
          <div class="field">
            <label>{{ 'USERS.ID_NUMBER' | translate }} <span class="required">*</span></label>
            <input type="tel" formControlName="idNumber" [placeholder]="'PLACEHOLDER.ENTER_ID_NUMBER' | translate" />
            @if (dialogForm.get('idNumber')?.hasError('required') && dialogForm.get('idNumber')?.touched) {
              <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
            } @else if (dialogForm.get('idNumber')?.hasError('pattern') && dialogForm.get('idNumber')?.touched) {
              <small class="field-error">{{ 'VALIDATION.DIGITS_ONLY' | translate }}</small>
            }
          </div>
          <div class="field full-width">
            <label>{{ 'USERS.PASSWORD' | translate }}</label>
            <input type="password" formControlName="password" autocomplete="new-password" [placeholder]="editingUser ? ('PLACEHOLDER.LEAVE_EMPTY_TO_KEEP' | translate) : ('PLACEHOLDER.ENTER_PASSWORD' | translate)" />
            @if (dialogForm.get('password')?.hasError('minlength') && dialogForm.get('password')?.touched) {
              <small class="field-error">{{ 'VALIDATION.MIN_LENGTH' | translate:{ min: 8 } }}</small>
            }
          </div>
          <div class="field full-width">
            <label>{{ 'USERS.ROLES' | translate }}</label>
            <div class="roles-grid">
              @for (role of availableRoles; track role.id) {
                <button type="button" class="role-toggle" [class.selected]="selectedRoleIds.has(role.id)" (click)="toggleRole(role.id)">
                  <i class="pi" [class.pi-check-circle]="selectedRoleIds.has(role.id)" [class.pi-circle]="!selectedRoleIds.has(role.id)"></i>
                  {{ role.name }}
                </button>
              }
            </div>
          </div>
          </div>
        </form>
        }
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="saveDialog()" [disabled]="dialogForm.invalid || saving">{{ 'COMMON.SAVE' | translate }}</button>
      </ng-template>
    </p-dialog>  `,
  styles: [`
    :host { display: block; }
    .header-actions { display: flex; gap: 0.5rem; }
    .table-card { padding: 0; overflow: hidden; }
    .table-header { display: flex; align-items: center; gap: 0.5rem; }
    .p-input-icon-left { position: relative; }
    .p-input-icon-left i { position: absolute; top: 50%; transform: translateY(-50%); inset-inline-start: 0.75rem; color: var(--color-text-muted, #9896ad); }
    .p-input-icon-left input { padding-inline-start: 2.25rem; }
    .filter-input { width: 100%; padding: 0.4rem 0.65rem; font-size: 0.82rem; }
    .actions { display: flex; gap: 0.3rem; align-items: center; }
    .dialog-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.15rem; }
    .full-width { grid-column: 1 / -1; }
    .dialog-form-grid .field { display: flex; flex-direction: column; }
    .dialog-form-grid .field label { display: block; font-weight: 500; margin-bottom: 0.3rem; font-size: 0.85rem; color: var(--color-text-secondary, #5c5a78); }

    .checkbox-group { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .checkbox-label { display: flex; align-items: center; gap: 0.35rem; font-size: 0.9rem; cursor: pointer; }

    .roles-grid {
      display: flex; flex-wrap: wrap; gap: 0.5rem;
      padding: 0.25rem 0;
    }
    .role-toggle {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.4rem 0.85rem;
      border: 1.5px solid var(--color-border, #d8d7e5);
      border-radius: 99px;
      background: #fff;
      color: var(--color-text-secondary, #5c5a78);
      font-size: 0.82rem; font-weight: 500;
      cursor: pointer;
      transition: all 0.18s ease;
      outline: none;
    }
    .role-toggle i { font-size: 0.85rem; transition: color 0.18s ease; }
    .role-toggle:hover {
      border-color: var(--color-accent, #6c63ff);
      background: var(--color-primary-wash, #eeedf8);
      color: var(--color-primary, #020140);
    }
    .role-toggle:focus-visible {
      box-shadow: 0 0 0 2px var(--color-accent-subtle, #ddd9ff);
      border-color: var(--color-accent, #6c63ff);
    }
    .role-toggle.selected {
      background: var(--color-accent-subtle, #ddd9ff);
      border-color: var(--color-accent, #6c63ff);
      color: var(--color-primary, #020140);
    }
    .role-toggle.selected i { color: var(--color-accent, #6c63ff); }
  `],
})
export class UserListComponent implements OnInit {
  private usersApi = inject(UsersApiService);
  private notify = inject(NotificationService);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private confirmService = inject(ConfirmService);
  users: User[] = [];
  totalRecords = 0;
  rows = 25;
  first = 0;
  sortField = 'firstName';
  sortOrder = 1;
  loading = false;
  private lastLazyEvent: any = { first: 0, rows: 25, sortField: 'firstName', sortOrder: 1, filters: {} };

  // Dialog
  showDialog = false;
  editingUser: User | null = null;
  dialogForm: FormGroup = new FormGroup({});
  saving = false;
  syncing = false;
  dialogLoading = false;
  availableRoles: Role[] = [];
  selectedRoleIds = new Set<string>();

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(event: any = this.lastLazyEvent): void {
    this.loading = true;
    this.lastLazyEvent = event;
    this.first = event.first ?? 0;
    this.rows = event.rows ?? 25;
    this.sortField = event.sortField || 'firstName';
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

    this.usersApi.getAll(params).subscribe((res) => {
      this.users = res.items;
      this.totalRecords = res.total;
      this.loading = false;
    });
  }

  onLazyLoad(event: any): void {
    this.loadUsers(event);
  }

  exportData(): void {
    const event = this.lastLazyEvent ?? {};
    const params: Record<string, string | number> = {
      sortBy: event.sortField || 'firstName',
      sortOrder: (event.sortOrder || 1) === 1 ? 'ASC' : 'DESC',
      filters: JSON.stringify(event.filters ?? {}),
    };
    const global = event.filters?.global?.value;
    if (global) params['search'] = global;

    this.usersApi.export(params).subscribe((blob) => {
      downloadBlob(blob, 'users.xlsx');
    });
  }

  syncFromAd(): void {
    this.syncing = true;
    this.usersApi.syncAd().subscribe({
      next: (res) => {
        this.syncing = false;
        if (res.configsProcessed === 0 && res.configsFailed === 0) {
          this.notify.warn(this.translate.instant('USERS.SYNC_NO_AD'));
        } else if (res.configsFailed > 0) {
          this.notify.warn(this.translate.instant('USERS.SYNC_PARTIAL', res));
        } else {
          this.notify.success(this.translate.instant('USERS.SYNC_SUCCESS', res));
        }
        this.loadUsers();
      },
      error: () => {
        this.syncing = false;
        this.notify.warn(this.translate.instant('USERS.SYNC_FAILED'));
      },
    });
  }

  onToggleActive(user: User): void {
    this.usersApi.update(user.id, { isActive: user.isActive }).subscribe({
      next: () => this.notify.success('COMMON.SUCCESS'),
      error: (err) => {
        user.isActive = !user.isActive;
        this.notify.error(err);
      },
    });
  }

  openDialog(user?: User): void {
    this.editingUser = user ?? null;
    this.selectedRoleIds = new Set<string>();
    this.dialogForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      username: ['', Validators.required],
      email: ['', Validators.pattern(EMAIL_PATTERN)],
      phone: ['', Validators.pattern(DIGITS_ONLY_PATTERN)],
      idNumber: ['', [Validators.required, Validators.pattern(DIGITS_ONLY_PATTERN)]],
      password: ['', [Validators.minLength(8)]],
    });
    this.dialogLoading = true;
    forkJoin({
      roles: this.usersApi.getRoles(),
      userData: user ? this.usersApi.getById(user.id) : of(null),
    }).subscribe(({ roles, userData }) => {
      this.availableRoles = roles.items;
      if (userData) {
        this.dialogForm.patchValue({
          firstName: userData.firstName,
          lastName: userData.lastName,
          username: userData.username,
          email: userData.email ?? '',
          phone: userData.phone ?? '',
          idNumber: userData.idNumber ?? '',
        });
        userData.roles.forEach((r) => this.selectedRoleIds.add(r.id));
      }
      this.dialogLoading = false;
    });
    this.showDialog = true;
  }

  toggleRole(id: string): void {
    if (this.selectedRoleIds.has(id)) this.selectedRoleIds.delete(id);
    else this.selectedRoleIds.add(id);
  }

  saveDialog(): void {
    if (this.dialogForm.invalid) return;
    this.saving = true;
    const { password, ...rest } = this.dialogForm.value;
    const payload = {
      ...rest,
      ...(password ? { password } : {}),
      roleIds: [...this.selectedRoleIds],
    };
    const req$ = this.editingUser
      ? this.usersApi.update(this.editingUser.id, payload)
      : this.usersApi.create(payload);
    req$.subscribe({
      next: () => { this.saving = false; this.showDialog = false; this.notify.success('COMMON.SUCCESS'); this.loadUsers(); },
      error: (err) => { this.saving = false; this.notify.error(err); },
    });
  }

  onDialogHide(): void {
    this.dialogForm.reset();
    this.dialogForm.markAsPristine();
    this.dialogForm.markAsUntouched();
  }
}
