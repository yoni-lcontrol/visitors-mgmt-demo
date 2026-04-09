import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ApiService } from '@core/api/api.service';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { AdConfiguration } from '@core/models/entities.model';

@Component({
  selector: 'app-ad-settings',
  standalone: true,
  imports: [TranslateModule, ReactiveFormsModule, HasPermissionDirective, TableModule, DialogModule, InputTextModule],
  template: `
    <div class="page-header">
      <h1>{{ 'AD_SETTINGS.TITLE' | translate }}</h1>
      <div class="header-actions">
        <button class="btn btn-primary" *hasPermission="'settings.update'" (click)="openDialog()">
          <i class="pi pi-plus"></i> {{ 'AD_SETTINGS.ADD_CONFIG' | translate }}
        </button>
      </div>
    </div>

    <div class="card table-card">
      <p-table
        [value]="configs"
        [loading]="loading"
        dataKey="id"
        styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>{{ 'AD_SETTINGS.NAME' | translate }}</th>
            <th>{{ 'AD_SETTINGS.DOMAIN' | translate }}</th>
            <th>{{ 'AD_SETTINGS.LDAP_URL' | translate }}</th>
            <th>{{ 'AD_SETTINGS.PORT' | translate }}</th>
            <th>{{ 'AD_SETTINGS.SSL' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-item>
          <tr>
            <td class="name-cell">
              <div>{{ item.name }}</div>
              @if (item.description) {
                <small class="desc-text">{{ item.description }}</small>
              }
            </td>
            <td>{{ item.domain }}</td>
            <td class="url-cell">{{ item.ldapUrl }}</td>
            <td>{{ item.port }}</td>
            <td>
              <span class="ssl-badge" [class.ssl-on]="item.useSsl" [class.ssl-off]="!item.useSsl">
                {{ item.useSsl ? ('COMMON.YES' | translate) : ('COMMON.NO' | translate) }}
              </span>
            </td>
            <td class="actions">
              <button class="btn-icon" *hasPermission="'settings.update'" (click)="openDialog(item)" [title]="'COMMON.EDIT' | translate">
                <i class="pi pi-pencil"></i>
              </button>
              <button class="btn-icon danger" *hasPermission="'settings.update'" (click)="onDelete(item)" [title]="'COMMON.DELETE' | translate">
                <i class="pi pi-trash"></i>
              </button>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="6" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Create / Edit Dialog -->
    <p-dialog
      [header]="editingConfig ? ('AD_SETTINGS.EDIT_CONFIG' | translate) : ('AD_SETTINGS.ADD_CONFIG' | translate)"
      [(visible)]="showDialog" (onHide)="onDialogHide()" [modal]="true" [style]="{width: '620px'}" [draggable]="false">
      @if (showDialog) {
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="dialog-form-grid">
            <div class="field full-width">
              <label>{{ 'AD_SETTINGS.NAME' | translate }} <span class="required">*</span></label>
              <input type="text" formControlName="name" [placeholder]="'PLACEHOLDER.ENTER_AD_NAME' | translate" />
              @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
            </div>
            <div class="field">
              <label>{{ 'AD_SETTINGS.DOMAIN' | translate }} <span class="required">*</span></label>
              <input type="text" formControlName="domain" [placeholder]="'PLACEHOLDER.ENTER_AD_DOMAIN' | translate" />
              @if (form.get('domain')?.hasError('required') && form.get('domain')?.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
            </div>
            <div class="field">
              <label>{{ 'AD_SETTINGS.LDAP_URL' | translate }} <span class="required">*</span></label>
              <input type="text" formControlName="ldapUrl" [placeholder]="'PLACEHOLDER.ENTER_AD_LDAP_URL' | translate" />
              @if (form.get('ldapUrl')?.hasError('required') && form.get('ldapUrl')?.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
            </div>
            <div class="field">
              <label>{{ 'AD_SETTINGS.BASE_DN' | translate }}</label>
              <input type="text" formControlName="baseDn" [placeholder]="'PLACEHOLDER.ENTER_AD_BASE_DN' | translate" />
            </div>
            <div class="field">
              <label>{{ 'AD_SETTINGS.USERNAME' | translate }} <span class="required">*</span></label>
              <input type="text" formControlName="username" [placeholder]="'PLACEHOLDER.ENTER_AD_USERNAME' | translate" />
              @if (form.get('username')?.hasError('required') && form.get('username')?.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
            </div>
            <div class="field">
              <label>{{ 'AD_SETTINGS.PASSWORD' | translate }} <span class="required">*</span></label>
              <input type="password" formControlName="password" autocomplete="new-password" [placeholder]="'PLACEHOLDER.ENTER_AD_PASSWORD' | translate" />
              @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
            </div>
            <div class="field">
              <label>{{ 'AD_SETTINGS.PORT' | translate }}</label>
              <input type="number" formControlName="port" [placeholder]="'PLACEHOLDER.ENTER_AD_PORT' | translate" />
            </div>
            <div class="field">
              <label>{{ 'AD_SETTINGS.SSL' | translate }}</label>
              <div class="ssl-toggle-row">
                <button type="button" class="toggle-pill" [class.active]="form.get('useSsl')?.value" (click)="form.patchValue({ useSsl: !form.get('useSsl')?.value })">
                  <i class="pi" [class.pi-check]="form.get('useSsl')?.value" [class.pi-times]="!form.get('useSsl')?.value"></i>
                  {{ form.get('useSsl')?.value ? ('COMMON.YES' | translate) : ('COMMON.NO' | translate) }}
                </button>
              </div>
            </div>
            <div class="field full-width">
              <label>{{ 'COMMON.DESCRIPTION' | translate }}</label>
              <textarea formControlName="description" rows="2" [placeholder]="'PLACEHOLDER.ENTER_DESCRIPTION' | translate"></textarea>
            </div>
          </div>
        </form>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="save()" [disabled]="form.invalid || saving">{{ 'COMMON.SAVE' | translate }}</button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host { display: block; }
    .table-card { padding: 0; overflow: hidden; }
    :host ::ng-deep .table-card .p-datatable-wrapper { padding-top: 0.85rem; }
    .name-cell { font-weight: 500; }
    .desc-text { display: block; color: var(--color-text-muted, #9896ad); font-size: 0.78rem; margin-top: 0.15rem; }
    .url-cell { font-family: monospace; font-size: 0.82rem; color: var(--color-text-secondary, #5c5a78); }
    .ssl-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
    .ssl-on { background: #e8f5e9; color: #2e7d32; }
    .ssl-off { background: var(--color-primary-wash, #eeedf8); color: var(--color-text-muted, #9896ad); }
    .actions { display: flex; gap: 0.3rem; align-items: center; }
    .dialog-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.15rem; }
    .full-width { grid-column: 1 / -1; }
    .dialog-form-grid .field { display: flex; flex-direction: column; }
    .dialog-form-grid .field label { font-weight: 500; margin-bottom: 0.3rem; font-size: 0.85rem; color: var(--color-text-secondary, #5c5a78); }
    .ssl-toggle-row { display: flex; align-items: center; }
    .toggle-pill {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.4rem 0.85rem; border: 1.5px solid var(--color-border, #d8d7e5);
      border-radius: 99px; background: #fff; color: var(--color-text-secondary, #5c5a78);
      font-size: 0.82rem; font-weight: 500; cursor: pointer; transition: all 0.18s ease;
    }
    .toggle-pill:hover { border-color: var(--color-accent, #6c63ff); }
    .toggle-pill.active {
      background: var(--color-accent-subtle, #ddd9ff); border-color: var(--color-accent, #6c63ff);
      color: var(--color-primary, #020140);
    }
    .toggle-pill i { font-size: 0.8rem; }
  `],
})
export class AdSettingsComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  private fb = inject(FormBuilder);
  private confirmService = inject(ConfirmService);

  configs: AdConfiguration[] = [];
  loading = false;

  showDialog = false;
  editingConfig: AdConfiguration | null = null;
  form: FormGroup = new FormGroup({});
  saving = false;

  ngOnInit(): void {
    this.loadConfigs();
  }

  loadConfigs(): void {
    this.loading = true;
    this.api.get<AdConfiguration[]>('/settings/ad-configurations').subscribe({
      next: (data) => {
        this.configs = data;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  openDialog(config?: AdConfiguration): void {
    this.editingConfig = config ?? null;
    this.form = this.fb.group({
      name: [config?.name ?? '', Validators.required],
      domain: [config?.domain ?? '', Validators.required],
      ldapUrl: [config?.ldapUrl ?? '', Validators.required],
      baseDn: [config?.baseDn ?? ''],
      username: [config?.username ?? '', Validators.required],
      password: ['', config ? [] : [Validators.required]],
      port: [config?.port ?? 389],
      useSsl: [config?.useSsl ?? false],
      description: [config?.description ?? ''],
    });
    this.showDialog = true;
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const payload = { ...this.form.value };
    if (this.editingConfig && !payload.password) {
      delete payload.password;
    }

    const req$ = this.editingConfig
      ? this.api.patch(`/settings/ad-configurations/${this.editingConfig.id}`, payload)
      : this.api.post('/settings/ad-configurations', payload);

    req$.subscribe({
      next: () => {
        this.saving = false;
        this.showDialog = false;
        this.notify.success('COMMON.SUCCESS');
        this.loadConfigs();
      },
      error: (err) => {
        this.saving = false;
        this.notify.error(err);
      },
    });
  }

  async onDelete(item: AdConfiguration): Promise<void> {
    if (await this.confirmService.confirm('AD_SETTINGS.DELETE_CONFIRM')) {
      this.api.delete(`/settings/ad-configurations/${item.id}`).subscribe({
        next: () => {
          this.notify.success('COMMON.SUCCESS');
          this.loadConfigs();
        },
        error: (err) => this.notify.error(err),
      });
    }
  }

  onDialogHide(): void {
    this.form.reset();
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}
