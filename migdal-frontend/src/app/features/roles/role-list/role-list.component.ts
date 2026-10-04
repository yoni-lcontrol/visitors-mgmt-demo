import { Component, OnInit, inject } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { RolesApiService } from '../services/roles-api.service';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { downloadBlob } from '@core/utils/download.util';
import { Role, Permission } from '@core/models/entities.model';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [TranslateModule, KeyValuePipe, ReactiveFormsModule, FormsModule, HasPermissionDirective, TableModule, InputTextModule, DialogModule],
  template: `
    <div class="page-header">
      <h1>{{ 'ROLES.TITLE' | translate }}</h1>
      <div class="header-actions">
        <button class="btn btn-secondary" *hasPermission="'roles.read'" (click)="exportData()"><i class="pi pi-file-excel"></i> {{ 'COMMON.EXPORT' | translate }}</button>
        <button class="btn btn-primary" *hasPermission="'roles.create'" (click)="openDialog()">
          <i class="pi pi-plus"></i> {{ 'ROLES.ADD_ROLE' | translate }}
        </button>
      </div>
    </div>
    <div class="card table-card">
      <p-table
        #dt
        [value]="roles"
        [lazy]="true"
        (onLazyLoad)="onLazyLoad($event)"
        [loading]="loading"
        [totalRecords]="totalRecords"
        [paginator]="true"
        [rows]="rows"
        [first]="first"
        [showCurrentPageReport]="true"
        [rowsPerPageOptions]="[10, 25, 50]"
        [globalFilterFields]="['name', 'description']"
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
            <th pSortableColumn="name">{{ 'ROLES.ROLE_NAME' | translate }} <p-sortIcon field="name" /> <p-columnFilter field="name" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="description">{{ 'COMMON.DESCRIPTION' | translate }} <p-sortIcon field="description" /> <p-columnFilter field="description" type="text" display="menu"></p-columnFilter></th>
            <th>{{ 'ROLES.PERMISSIONS' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-role>
          <tr>
            <td>
              {{ role.name }}
              @if (role.isSystem) { <span class="system-badge">{{ 'ROLES.SYSTEM_ROLE' | translate }}</span> }
            </td>
            <td>{{ role.description }}</td>
            <td>{{ role.permissions.length }}</td>
            <td class="actions">
              <button class="btn-icon" *hasPermission="'roles.update'" (click)="openDialog(role)" [title]="'COMMON.EDIT' | translate">
                <i class="pi pi-pencil"></i>
              </button>
              @if (!role.isSystem) {
                <button class="btn-icon danger" *hasPermission="'roles.delete'" (click)="onDelete(role)" [title]="'COMMON.DELETE' | translate">
                  <i class="pi pi-trash"></i>
                </button>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="4" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
        </ng-template>
      </p-table>
    </div>
    <!-- Create / Edit Dialog -->
    <p-dialog [header]="editingRole ? ('ROLES.EDIT_ROLE' | translate) : ('ROLES.ADD_ROLE' | translate)"
      [(visible)]="showDialog" (onHide)="onDialogHide()" [modal]="true" [style]="{width: '760px'}" [draggable]="false">
      @if (showDialog) {
        @if (dialogLoading) {
          <div class="loading">{{ 'COMMON.LOADING' | translate }}</div>
        } @else {
        <form [formGroup]="dialogForm" (ngSubmit)="saveDialog()">
          <div class="dialog-section">
          <h3 class="section-title"><i class="pi pi-tag"></i> {{ 'ROLES_FORM.ROLE_DETAILS' | translate }}</h3>
          <div class="dialog-fields">
            <div class="field">
              <label>{{ 'ROLES.ROLE_NAME' | translate }} <span class="required">*</span></label>
              <input type="text" formControlName="name" [placeholder]="'PLACEHOLDER.ENTER_ROLE_NAME' | translate" />
              @if (dialogForm.get('name')?.hasError('required') && dialogForm.get('name')?.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
            </div>
            <div class="field">
              <label>{{ 'COMMON.DESCRIPTION' | translate }}</label>
              <textarea formControlName="description" rows="2" [placeholder]="'PLACEHOLDER.ENTER_DESCRIPTION' | translate"></textarea>
            </div>
          </div>
        </div>

        <div class="dialog-section permissions-section">
          <div class="section-header">
            <h3 class="section-title"><i class="pi pi-shield"></i> {{ 'ROLES.ASSIGN_PERMISSIONS' | translate }}</h3>
            <div class="perm-actions">
              <button type="button" class="btn-link" (click)="selectAllPerms()">{{ 'ROLES_FORM.SELECT_ALL' | translate }}</button>
              <span class="divider">|</span>
              <button type="button" class="btn-link" (click)="deselectAllPerms()">{{ 'ROLES_FORM.CLEAR_ALL' | translate }}</button>
            </div>
          </div>
          <div class="perm-toolbar">
            <div class="perm-search">
              <i class="pi pi-search"></i>
              <input type="text" [(ngModel)]="permSearch" [ngModelOptions]="{standalone: true}"
                [placeholder]="'ROLES_FORM.SEARCH_PERMISSIONS' | translate" (input)="onPermSearchChange()" />
              @if (permSearch) {
                <button type="button" class="perm-search-clear" (click)="permSearch = ''; onPermSearchChange()"><i class="pi pi-times"></i></button>
              }
            </div>
            <div class="perm-toolbar-right">
              <span class="perm-count">{{ selectedPermIds.size }}/{{ totalPermCount }}</span>
              <button type="button" class="btn-link" (click)="expandAllGroups()">{{ 'ROLES_FORM.EXPAND_ALL' | translate }}</button>
              <span class="divider">|</span>
              <button type="button" class="btn-link" (click)="collapseAllGroups()">{{ 'ROLES_FORM.COLLAPSE_ALL' | translate }}</button>
            </div>
          </div>
          @if (filteredPermissionGroups | keyvalue; as groups) {
            @if (groups.length === 0 && permSearch) {
              <div class="perm-no-results">
                <i class="pi pi-search"></i>
                {{ 'ROLES_FORM.NO_PERMISSIONS_FOUND' | translate }}
              </div>
            }
            @for (entry of groups; track entry.key) {
              <div class="perm-group" [class.expanded]="expandedGroups.has(entry.key)">
                <button type="button" class="perm-group-header" (click)="toggleGroup(entry.key)">
                  <div class="group-left">
                    <i class="pi" [class.pi-chevron-right]="!expandedGroups.has(entry.key)" [class.pi-chevron-down]="expandedGroups.has(entry.key)"></i>
                    <span class="group-name">{{ 'PERMISSIONS.MODULES.' + entry.key | translate }}</span>
                    <span class="group-count" [class.group-count-full]="isGroupFullySelected(entry.key)">{{ getGroupSelectedCount(entry.key) }}/{{ (permissionGroups[entry.key] || []).length }}</span>
                  </div>
                  <label class="toggle-all-label" (click)="$event.stopPropagation()">
                    <input type="checkbox"
                      [checked]="isGroupFullySelected(entry.key)"
                      [indeterminate]="isGroupPartiallySelected(entry.key)"
                      (change)="toggleGroupAll(entry.key)" />
                    {{ 'ROLES_FORM.ALL' | translate }}
                  </label>
                </button>
                @if (expandedGroups.has(entry.key)) {
                  <div class="perm-group-body">
                    @for (perm of entry.value; track perm.id) {
                      <label class="perm-item" [class.selected]="selectedPermIds.has(perm.id)">
                        <input type="checkbox" [checked]="selectedPermIds.has(perm.id)" (change)="togglePerm(perm.id)" />
                        <div class="perm-info">
                          <span class="perm-name">{{ getPermissionNameKey(perm.key) | translate }}</span>
                          @if (perm.description) {
                            <span class="perm-desc">{{ getPermissionDescriptionKey(perm.key) | translate }}</span>
                          }
                        </div>
                        <span class="perm-action-badge" [attr.data-action]="getActionType(perm.action)">
                          {{ ('ROLES_FORM.ACTION_' + getActionType(perm.action).toUpperCase()) | translate }}
                        </span>
                      </label>
                    }
                  </div>
                }
              </div>
            }
          }
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
    .table-card { padding: 0; overflow: hidden; }
    .table-header { display: flex; align-items: center; gap: 0.5rem; }
    .p-input-icon-left { position: relative; }
    .p-input-icon-left i { position: absolute; top: 50%; transform: translateY(-50%); inset-inline-start: 0.75rem; color: var(--color-text-muted, #9896ad); }
    .p-input-icon-left input { padding-inline-start: 2.25rem; }
    .filter-input { width: 100%; padding: 0.4rem 0.65rem; font-size: 0.82rem; }
    .system-badge { display: inline-block; padding: 0.12rem 0.45rem; background: #fff8e1; color: #f57f17; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-inline-start: 0.5rem; }
    .actions { display: flex; gap: 0.3rem; align-items: center; }
    .dialog-section { margin-bottom: 1.25rem; }
    .section-title { display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; font-weight: 600; color: var(--color-primary, #020140); margin: 0 0 1rem; padding-bottom: 0.6rem; border-bottom: 2px solid var(--color-border, #e4e2f0); }
    .section-title i { font-size: 1rem; color: var(--color-accent, #6c63ff); }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; padding-bottom: 0.6rem; border-bottom: 2px solid var(--color-border, #e4e2f0); }
    .section-header .section-title { border-bottom: none; margin: 0; padding: 0; }
    .dialog-fields { display: flex; flex-direction: column; gap: 1rem; }
    .dialog-fields .field { display: flex; flex-direction: column; }
    .dialog-fields .field label { font-weight: 500; margin-bottom: 0.35rem; font-size: 0.85rem; color: var(--color-text-secondary, #5c5a78); }
    .dialog-fields .field textarea { resize: vertical; min-height: 50px; }
    .perm-actions { display: flex; align-items: center; gap: 0.5rem; }
    .btn-link { background: none; border: none; cursor: pointer; color: var(--color-accent, #6c63ff); font-size: 0.8rem; font-weight: 500; padding: 0; font-family: inherit; transition: color 0.2s; }
    .btn-link:hover { color: var(--color-accent-hover, #5a52e0); text-decoration: underline; }
    .divider { color: var(--color-border, #e4e2f0); font-size: 0.75rem; }

    /* Toolbar with search and actions */
    .perm-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem; }
    .perm-toolbar-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
    .perm-search { position: relative; flex: 1; max-width: 280px; }
    .perm-search i.pi-search { position: absolute; top: 50%; transform: translateY(-50%); inset-inline-start: 0.65rem; color: var(--color-text-muted, #9896ad); font-size: 0.82rem; pointer-events: none; }
    .perm-search input { width: 100%; padding: 0.45rem 2rem 0.45rem 2rem; font-size: 0.82rem; border: 1.5px solid var(--color-border, #e4e2f0); border-radius: 6px; font-family: inherit; background: var(--color-surface, #fff); color: var(--color-text, #1a1a2e); transition: border-color 0.2s; }
    .perm-search input:focus { outline: none; border-color: var(--color-accent, #6c63ff); box-shadow: 0 0 0 2px rgba(108,99,255,0.12); }
    .perm-search input::placeholder { color: var(--color-text-muted, #9896ad); }
    .perm-search-clear { position: absolute; top: 50%; transform: translateY(-50%); inset-inline-end: 0.5rem; background: none; border: none; cursor: pointer; color: var(--color-text-muted, #9896ad); font-size: 0.75rem; padding: 0.15rem; border-radius: 50%; transition: color 0.2s, background 0.2s; }
    .perm-search-clear:hover { color: var(--color-text, #1a1a2e); background: var(--color-primary-wash, #eeedf8); }
    .perm-count { font-size: 0.78rem; font-weight: 600; color: var(--color-text-muted, #9896ad); background: var(--color-primary-wash, #eeedf8); padding: 0.2rem 0.55rem; border-radius: 99px; white-space: nowrap; }
    .perm-no-results { text-align: center; padding: 1.5rem 1rem; color: var(--color-text-muted, #9896ad); font-size: 0.85rem; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
    .perm-no-results i { font-size: 1.3rem; }

    /* Permission groups */
    .permissions-section { max-height: 420px; overflow-y: auto; padding-inline-end: 0.25rem; }
    .perm-group { border: 1.5px solid var(--color-border, #e4e2f0); border-radius: 8px; margin-bottom: 0.45rem; overflow: hidden; transition: border-color 0.2s; }
    .perm-group:hover { border-color: var(--color-accent, #6c63ff); }
    .perm-group.expanded { border-color: rgba(108,99,255,0.3); }
    .perm-group-header { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0.55rem 0.85rem; background: var(--color-surface-alt, #f8f7fc); border: none; cursor: pointer; font-family: inherit; transition: background 0.2s; }
    .perm-group-header:hover { background: var(--color-primary-wash, #eeedf8); }
    .group-left { display: flex; align-items: center; gap: 0.5rem; }
    .group-left i { font-size: 0.75rem; color: var(--color-text-muted, #9896ad); transition: transform 0.2s; }
    .group-name { font-weight: 600; font-size: 0.85rem; color: var(--color-primary, #020140); text-transform: capitalize; }
    .group-count { font-size: 0.7rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 99px; background: var(--color-accent-subtle, #ddd9ff); color: var(--color-primary, #020140); transition: background 0.2s, color 0.2s; }
    .group-count-full { background: var(--color-accent, #6c63ff); color: #fff; }
    .toggle-all-label { display: flex; align-items: center; gap: 0.3rem; font-size: 0.78rem; font-weight: 500; color: var(--color-text-secondary, #5c5a78); cursor: pointer; }
    .toggle-all-label input { cursor: pointer; }
    .perm-group-body { padding: 0.25rem 0.4rem; }
    .perm-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.55rem; border-radius: 6px; cursor: pointer; transition: background 0.15s; }
    .perm-item:hover { background: var(--color-primary-wash, #eeedf8); }
    .perm-item.selected { background: rgba(108,99,255,0.06); }
    .perm-item input { cursor: pointer; flex-shrink: 0; accent-color: var(--color-accent, #6c63ff); width: 15px; height: 15px; }
    .perm-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
    .perm-name { font-size: 0.82rem; font-weight: 500; color: var(--color-text, #1a1a2e); }
    .perm-desc { font-size: 0.72rem; color: var(--color-text-muted, #9896ad); line-height: 1.3; }

    /* Action-type badges */
    .perm-action-badge { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.12rem 0.4rem; border-radius: 4px; flex-shrink: 0; white-space: nowrap; }
    .perm-action-badge[data-action="read"] { background: #e8f5e9; color: #2e7d32; }
    .perm-action-badge[data-action="view"] { background: #e8f5e9; color: #2e7d32; }
    .perm-action-badge[data-action="create"] { background: #e3f2fd; color: #1565c0; }
    .perm-action-badge[data-action="update"] { background: #fff3e0; color: #e65100; }
    .perm-action-badge[data-action="delete"] { background: #fce4ec; color: #c62828; }
    .perm-action-badge[data-action="manage"] { background: #f3e5f5; color: #6a1b9a; }
    .perm-action-badge[data-action="other"] { background: var(--color-primary-wash, #eeedf8); color: var(--color-text-secondary, #5c5a78); }
  `],
})
export class RoleListComponent implements OnInit {
  private rolesApi = inject(RolesApiService);
  private notify = inject(NotificationService);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private confirmService = inject(ConfirmService);
  roles: Role[] = [];
  totalRecords = 0;
  rows = 25;
  first = 0;
  sortField = 'name';
  sortOrder = 1;
  loading = false;
  private lastLazyEvent: any = { first: 0, rows: 25, sortField: 'name', sortOrder: 1, filters: {} };

  // Dialog
  showDialog = false;
  editingRole: Role | null = null;
  dialogForm: FormGroup = new FormGroup({});
  saving = false;
  dialogLoading = false;
  permissionGroups: Record<string, Permission[]> = {};
  filteredPermissionGroups: Record<string, Permission[]> = {};
  selectedPermIds = new Set<string>();
  expandedGroups = new Set<string>();
  permSearch = '';
  totalPermCount = 0;

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(event: any = this.lastLazyEvent): void {
    this.loading = true;
    this.lastLazyEvent = event;
    this.first = event.first ?? 0;
    this.rows = event.rows ?? 25;
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

    this.rolesApi.getAll(params).subscribe((r) => {
      this.roles = r.items;
      this.totalRecords = r.total;
      this.loading = false;
    });
  }

  onLazyLoad(event: any): void {
    this.loadRoles(event);
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

    this.rolesApi.export(params).subscribe((blob) => {
      downloadBlob(blob, 'roles.xlsx');
    });
  }

  async onDelete(role: Role): Promise<void> {
    if (await this.confirmService.confirm('ROLES.DELETE_CONFIRM')) {
      this.rolesApi.delete(role.id).subscribe({
        next: () => {
          this.notify.success('COMMON.SUCCESS');
          this.loadRoles();
        },
        error: (err) => this.notify.error(err),
      });
    }
  }

  openDialog(role?: Role): void {
    this.editingRole = role ?? null;
    this.selectedPermIds = new Set<string>();
    this.expandedGroups = new Set<string>();
    this.permSearch = '';
    this.dialogForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
    });
    this.dialogLoading = true;
    forkJoin({
      groups: this.rolesApi.getPermissionsGrouped(),
      roleData: role ? this.rolesApi.getById(role.id) : of(null),
    }).subscribe(({ groups, roleData }) => {
      this.permissionGroups = groups;
      this.filteredPermissionGroups = { ...groups };
      this.totalPermCount = Object.values(groups).flat().length;
      if (roleData) {
        this.dialogForm.patchValue({ name: roleData.name, description: roleData.description });
        roleData.permissions.forEach((p) => this.selectedPermIds.add(p.id));
      }
      this.dialogLoading = false;
    });
    this.showDialog = true;
  }

  toggleGroup(key: string): void {
    if (this.expandedGroups.has(key)) this.expandedGroups.delete(key);
    else this.expandedGroups.add(key);
  }

  isGroupFullySelected(key: string): boolean {
    const perms = this.permissionGroups[key];
    return perms?.length > 0 && perms.every((p) => this.selectedPermIds.has(p.id));
  }

  isGroupPartiallySelected(key: string): boolean {
    const perms = this.permissionGroups[key];
    if (!perms) return false;
    const count = perms.filter((p) => this.selectedPermIds.has(p.id)).length;
    return count > 0 && count < perms.length;
  }

  getGroupSelectedCount(key: string): number {
    return (this.permissionGroups[key] ?? []).filter((p) => this.selectedPermIds.has(p.id)).length;
  }

  toggleGroupAll(key: string): void {
    const perms = this.permissionGroups[key];
    if (!perms) return;
    if (this.isGroupFullySelected(key)) {
      perms.forEach((p) => this.selectedPermIds.delete(p.id));
    } else {
      perms.forEach((p) => this.selectedPermIds.add(p.id));
    }
  }

  selectAllPerms(): void {
    Object.values(this.permissionGroups).flat().forEach((p) => this.selectedPermIds.add(p.id));
  }

  deselectAllPerms(): void {
    this.selectedPermIds.clear();
  }

  togglePerm(id: string): void {
    if (this.selectedPermIds.has(id)) this.selectedPermIds.delete(id);
    else this.selectedPermIds.add(id);
  }

  onPermSearchChange(): void {
    const term = this.permSearch.trim().toLowerCase();
    if (!term) {
      this.filteredPermissionGroups = { ...this.permissionGroups };
      return;
    }
    const filtered: Record<string, Permission[]> = {};
    for (const [key, perms] of Object.entries(this.permissionGroups)) {
      const matching = perms.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.key.toLowerCase().includes(term) ||
          (p.description ?? '').toLowerCase().includes(term) ||
          this.translate.instant(this.getPermissionNameKey(p.key)).toLowerCase().includes(term) ||
          this.translate.instant(this.getPermissionDescriptionKey(p.key)).toLowerCase().includes(term) ||
          this.translate.instant('ROLES_FORM.ACTION_' + this.getActionType(p.action).toUpperCase()).toLowerCase().includes(term)
      );
      if (matching.length > 0) {
        filtered[key] = matching;
        this.expandedGroups.add(key);
      }
    }
    this.filteredPermissionGroups = filtered;
  }

  expandAllGroups(): void {
    const groups = Object.keys(this.filteredPermissionGroups);
    groups.forEach((k) => this.expandedGroups.add(k));
  }

  collapseAllGroups(): void {
    this.expandedGroups.clear();
  }

  getActionType(action: string): string {
    const a = action.toLowerCase();
    if (a.includes('read') || a.includes('view') || a.includes('get') || a.includes('list')) return 'read';
    if (a.includes('create') || a.includes('add')) return 'create';
    if (a.includes('update') || a.includes('edit') || a.includes('modify')) return 'update';
    if (a.includes('delete') || a.includes('remove')) return 'delete';
    if (a.includes('manage') || a.includes('admin') || a.includes('assign')) return 'manage';
    return 'other';
  }

  getPermissionNameKey(permissionKey: string): string {
    switch (permissionKey) {
      case 'visits.on-behalf-only':
        return 'PERMISSIONS.NAMES.visits.on-behalf-only';
      case 'visits.escort.required':
        return 'PERMISSIONS.NAMES.visits.escort.required.label';
      case 'visits.escort.required.self-requester':
        return 'PERMISSIONS.NAMES.visits.escort.required.self-requester';
      case 'visits.escort.required.as-requester':
        return 'PERMISSIONS.NAMES.visits.escort.required.as-requester';
      case 'visits.scope.own':
        return 'PERMISSIONS.NAMES.visits.scope.own';
      case 'visits.scope.all':
        return 'PERMISSIONS.NAMES.visits.scope.all';
      case 'visits.scope.training-center':
        return 'PERMISSIONS.NAMES.visits.scope.training-center';
      case 'visits.scope.domain':
        return 'PERMISSIONS.NAMES.visits.scope.domain';
      case 'visits.delete.own-only':
        return 'PERMISSIONS.NAMES.visits.delete-own-only';
      case 'visits.import':
        return 'PERMISSIONS.NAMES.visits.import';
      case 'visitors.scope.own':
        return 'PERMISSIONS.NAMES.visitors.scope.own';
      default:
        return 'PERMISSIONS.NAMES.' + permissionKey;
    }
  }

  getPermissionDescriptionKey(permissionKey: string): string {
    switch (permissionKey) {
      case 'visits.on-behalf-only':
        return 'PERMISSIONS.DESCRIPTIONS.visits.on-behalf-only';
      case 'visits.escort.required':
        return 'PERMISSIONS.DESCRIPTIONS.visits.escort.required.label';
      case 'visits.escort.required.self-requester':
        return 'PERMISSIONS.DESCRIPTIONS.visits.escort.required.self-requester';
      case 'visits.escort.required.as-requester':
        return 'PERMISSIONS.DESCRIPTIONS.visits.escort.required.as-requester';
      case 'visits.scope.own':
        return 'PERMISSIONS.DESCRIPTIONS.visits.scope.own';
      case 'visits.scope.all':
        return 'PERMISSIONS.DESCRIPTIONS.visits.scope.all';
      case 'visits.scope.training-center':
        return 'PERMISSIONS.DESCRIPTIONS.visits.scope.training-center';
      case 'visits.scope.domain':
        return 'PERMISSIONS.DESCRIPTIONS.visits.scope.domain';
      case 'visits.delete.own-only':
        return 'PERMISSIONS.DESCRIPTIONS.visits.delete-own-only';
      case 'visits.import':
        return 'PERMISSIONS.DESCRIPTIONS.visits.import';
      case 'visitors.scope.own':
        return 'PERMISSIONS.DESCRIPTIONS.visitors.scope.own';
      default:
        return 'PERMISSIONS.DESCRIPTIONS.' + permissionKey;
    }
  }

  saveDialog(): void {
    if (this.dialogForm.invalid) return;
    this.saving = true;
    const payload = { ...this.dialogForm.value, permissionIds: [...this.selectedPermIds] };
    const req$ = this.editingRole
      ? this.rolesApi.update(this.editingRole.id, payload)
      : this.rolesApi.create(payload);
    req$.subscribe({
      next: () => { this.saving = false; this.showDialog = false; this.notify.success('COMMON.SUCCESS'); this.loadRoles(); },
      error: (err) => { this.saving = false; this.notify.error(err); },
    });
  }

  onDialogHide(): void {
    this.dialogForm.reset();
    this.dialogForm.markAsPristine();
    this.dialogForm.markAsUntouched();
  }
}
