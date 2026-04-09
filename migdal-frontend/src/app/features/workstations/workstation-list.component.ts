import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { UserWebSocketService } from '@core/websocket/user-websocket.service';
import { WsEvent } from '@core/websocket/ws-events.enum';
import { WorkstationListItem } from '@core/models/entities.model';
import { WorkstationsApiService } from './workstations-api.service';
import { CardTemplateApiService } from '../settings/services/card-template-api.service';
import { CardTemplate } from '../settings/card-templates/models/card-template.model';

@Component({
  selector: 'app-workstation-list',
  standalone: true,
  imports: [TranslateModule, ReactiveFormsModule, HasPermissionDirective, TableModule, DialogModule],
  template: `
    <div class="page-header">
      <h1>{{ 'WORKSTATIONS.TITLE' | translate }}</h1>
      <div class="header-actions">
        <button class="btn btn-primary" *hasPermission="'workstations.create'" (click)="openCreateDialog()">
          <i class="pi pi-plus"></i> {{ 'WORKSTATIONS.ADD' | translate }}
        </button>
      </div>
    </div>
    <div class="card table-card">
      <p-table
        [value]="workstations"
        [loading]="loading"
        dataKey="id"
        styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>{{ 'WORKSTATIONS.CODE' | translate }}</th>
            <th>{{ 'WORKSTATIONS.DISPLAY_NAME' | translate }}</th>
            <th>{{ 'WORKSTATIONS.DESCRIPTION' | translate }}</th>
            <th>{{ 'WORKSTATIONS.MACHINE_ID' | translate }}</th>
            <th>{{ 'WORKSTATIONS.DEVICES' | translate }}</th>
            <th>{{ 'WORKSTATIONS.ASSIGNED_ROLES' | translate }}</th>
            <th>{{ 'WORKSTATIONS.DEFAULT_CARD_TEMPLATE' | translate }}</th>
            <th>{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-ws>
          <tr>
            <td><code>{{ ws.code }}</code></td>
            <td>{{ ws.displayName }}</td>
            <td>{{ ws.description || '-' }}</td>
            <td>{{ ws.machineId || '-' }}</td>
            <td>
              @for (d of ws.devices; track d.providerType) {
                <span class="device-badge" [class.connected]="d.isConnected" [class.disconnected]="!d.isConnected">
                  <i class="pi" [class.pi-print]="d.providerType === 'printer'" [class.pi-camera]="d.providerType === 'scanner'"></i>
                  {{ d.providerType }}
                </span>
              }
              @if (ws.devices.length === 0) { <span class="text-muted">-</span> }
            </td>
            <td>{{ ws.assignedRoles }}</td>
            <td>{{ ws.defaultCardTemplateName || '-' }}</td>
            <td class="actions">
              <button class="btn-icon" *hasPermission="'workstations.update'" (click)="openEditDialog(ws)" [title]="'COMMON.EDIT' | translate">
                <i class="pi pi-pencil"></i>
              </button>
              <button class="btn-icon" *hasPermission="'workstations.enroll-agents'" (click)="openEnrollDialog(ws)" [title]="'WORKSTATIONS.ENROLL_AGENT' | translate">
                <i class="pi pi-key"></i>
              </button>
              <button class="btn-icon danger" *hasPermission="'workstations.delete'" (click)="onDelete(ws)" [title]="'COMMON.DELETE' | translate">
                <i class="pi pi-trash"></i>
              </button>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="8" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Create / Edit Dialog -->
    <p-dialog
      [header]="editingWorkstation ? ('WORKSTATIONS.EDIT' | translate) : ('WORKSTATIONS.ADD' | translate)"
      [(visible)]="showFormDialog"
      [modal]="true" [style]="{width: '480px'}" [draggable]="false"
    >
      @if (showFormDialog) {
        <form [formGroup]="formGroup" (ngSubmit)="saveWorkstation()">
          <div class="dialog-fields">
            <div class="field">
              <label>{{ 'WORKSTATIONS.DISPLAY_NAME' | translate }} <span class="required">*</span></label>
              <input type="text" formControlName="displayName"
                [placeholder]="'WORKSTATIONS.DISPLAY_NAME_PLACEHOLDER' | translate"
                [class.invalid]="formGroup.get('displayName')?.invalid && formGroup.get('displayName')?.touched" />
              @if (formGroup.get('displayName')?.invalid && formGroup.get('displayName')?.touched) {
                <small class="field-error">{{ 'WORKSTATIONS.DISPLAY_NAME_REQUIRED' | translate }}</small>
              }
            </div>
            @if (!editingWorkstation) {
              <div class="field">
                <label>{{ 'WORKSTATIONS.CODE' | translate }}</label>
                <input type="text" formControlName="code"
                  [placeholder]="'WORKSTATIONS.CODE_PLACEHOLDER' | translate"
                  [class.invalid]="formGroup.get('code')?.invalid && formGroup.get('code')?.touched" />
              </div>
            }
            <div class="field">
              <label>{{ 'WORKSTATIONS.DESCRIPTION' | translate }}</label>
              <input type="text" formControlName="description"
                [placeholder]="'WORKSTATIONS.DESCRIPTION_PLACEHOLDER' | translate" />
            </div>
            <div class="field">
              <label>{{ 'WORKSTATIONS.DEFAULT_CARD_TEMPLATE' | translate }}</label>
              <select formControlName="defaultCardTemplateId">
                <option [value]="''">{{ 'WORKSTATIONS.NO_TEMPLATE' | translate }}</option>
                @for (t of cardTemplates; track t.id) {
                  <option [value]="t.id">{{ t.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label>{{ 'WORKSTATIONS.ASSIGN_ROLES' | translate }}</label>
              <div class="assign-grid">
                @for (r of allRoles; track r.id) {
                    <button type="button" class="role-toggle" [class.selected]="selectedRoleIds.has(r.id)" (click)="toggleRoleId(r.id)">
                      <i class="pi" [class.pi-check-circle]="selectedRoleIds.has(r.id)" [class.pi-circle]="!selectedRoleIds.has(r.id)"></i>
                      {{ r.name }}
                    </button>
                  }
                  @if (allRoles.length === 0) {
                    <span class="text-muted">{{ 'WORKSTATIONS.NO_ROLES' | translate }}</span>
                  }
                </div>
              </div>
          </div>
        </form>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showFormDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="saveWorkstation()" [disabled]="formGroup.invalid || saving">{{ 'COMMON.SAVE' | translate }}</button>
      </ng-template>
    </p-dialog>

    <!-- Enrollment Token Dialog -->
    <p-dialog
      [header]="'WORKSTATIONS.ENROLL_AGENT' | translate"
      [(visible)]="showEnrollDialog"
      [modal]="true" [style]="{width: '480px'}" [draggable]="false"
    >
      @if (showEnrollDialog && enrollTarget) {
        <div class="dialog-fields">
          <div class="field">
            <label>{{ 'WORKSTATIONS.PROVIDER_TYPE' | translate }}</label>
            <select [(value)]="enrollProviderType" (change)="enrollProviderType = $any($event.target).value">
              <option value="printer">{{ 'WORKSTATION.PRINTER' | translate }}</option>
              <option value="scanner">{{ 'WORKSTATION.SCANNER' | translate }}</option>
            </select>
          </div>
          @if (generatedToken) {
            <div class="token-display">
              <label>{{ 'WORKSTATIONS.ENROLLMENT_TOKEN' | translate }}</label>
              <code class="token-value">{{ generatedToken }}</code>
              <small class="text-muted">{{ 'WORKSTATIONS.TOKEN_EXPIRES' | translate:{ date: tokenExpiresAt } }}</small>
            </div>
          }
        </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showEnrollDialog = false">{{ 'COMMON.CLOSE' | translate }}</button>
        <button class="btn btn-primary" (click)="generateToken()" [disabled]="enrollGenerating">
          <i class="pi pi-key"></i> {{ 'WORKSTATIONS.GENERATE_TOKEN' | translate }}
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host { display: block; }
    .header-actions { display: flex; gap: 0.5rem; }
    .table-card { padding: 0; overflow: hidden; }
    :host ::ng-deep .table-card .p-datatable-wrapper { padding-top: 0.85rem; }
    .actions { display: flex; gap: 0.3rem; align-items: center; }
    .device-badge {
      display: inline-flex; align-items: center; gap: 0.25rem;
      padding: 0.15rem 0.5rem; border-radius: 12px; font-size: 0.78rem;
      margin-inline-end: 0.3rem;
    }
    .device-badge.connected { background: #dcfce7; color: #15803d; }
    .device-badge.disconnected { background: #f1f5f9; color: #64748b; }
    .text-muted { color: var(--color-text-muted, #9896ad); }
    .dialog-fields { display: flex; flex-direction: column; gap: 1rem; }
    .dialog-fields .field { display: flex; flex-direction: column; }
    .dialog-fields .field label { font-weight: 500; margin-bottom: 0.3rem; font-size: 0.85rem; color: var(--color-text-secondary, #5c5a78); }
    .dialog-fields .field input, .dialog-fields .field select {
      padding: 0.45rem 0.65rem; border: 1.5px solid var(--color-border, #e4e2f0);
      border-radius: var(--radius-sm, 6px); font-size: 0.9rem; font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .dialog-fields .field input:focus, .dialog-fields .field select:focus {
      outline: none; border-color: var(--color-accent, #6c63ff);
      box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.12);
    }
    .dialog-fields .field input.invalid {
      border-color: var(--color-danger, #e74c3c);
    }
    .dialog-fields .field input.invalid:focus {
      box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.12);
    }
    .field-error {
      color: var(--color-danger, #e74c3c); font-size: 0.78rem; margin-top: 0.2rem;
    }
    .required { color: var(--color-danger, #e74c3c); }
    .assign-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.5rem 0; }
    .role-toggle {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.4rem 0.85rem; border: 1.5px solid var(--color-border, #d8d7e5);
      border-radius: 99px; background: #fff; color: var(--color-text-secondary, #5c5a78);
      font-size: 0.82rem; font-weight: 500; cursor: pointer; transition: all 0.18s ease;
    }
    .role-toggle:hover { border-color: var(--color-accent, #6c63ff); background: var(--color-primary-wash, #eeedf8); }
    .role-toggle.selected { background: var(--color-accent-subtle, #ddd9ff); border-color: var(--color-accent, #6c63ff); color: var(--color-primary, #020140); }
    .role-toggle.selected i { color: var(--color-accent, #6c63ff); }
    .token-display { display: flex; flex-direction: column; gap: 0.35rem; padding: 1rem; background: var(--color-surface-alt, #f8f7fc); border-radius: var(--radius-sm, 6px); border: 1px solid var(--color-border-light, #eeedfa); }
    .token-value { font-size: 0.85rem; padding: 0.5rem; background: #fff; border-radius: 4px; word-break: break-all; user-select: all; border: 1px solid var(--color-border, #e4e2f0); }
    h4 { margin: 1rem 0 0.25rem; font-size: 0.9rem; color: var(--color-primary, #020140); font-weight: 600; }
  `],
})
export class WorkstationListComponent implements OnInit, OnDestroy {
  private wsApi = inject(WorkstationsApiService);
  private cardTemplateApi = inject(CardTemplateApiService);
  private notify = inject(NotificationService);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private confirmService = inject(ConfirmService);
  private userWs = inject(UserWebSocketService);
  private statusSub?: Subscription;

  workstations: WorkstationListItem[] = [];
  loading = false;

  // Form dialog
  showFormDialog = false;
  editingWorkstation: WorkstationListItem | null = null;
  formGroup: FormGroup = this.fb.group({
    displayName: ['', Validators.required],
    code: [''],
    description: [''],
    defaultCardTemplateId: [''],
  });
  saving = false;

  // Role assignment (inside form dialog)
  allRoles: { id: string; name: string }[] = [];
  selectedRoleIds = new Set<string>();

  // Card templates for dropdown
  cardTemplates: CardTemplate[] = [];

  // Enroll dialog
  showEnrollDialog = false;
  enrollTarget: WorkstationListItem | null = null;
  enrollProviderType = 'printer';
  generatedToken: string | null = null;
  tokenExpiresAt: string | null = null;
  enrollGenerating = false;

  ngOnInit(): void {
    this.loadWorkstations();
    this.statusSub = this.userWs.on<{
      workstationId: string;
      providerType: string;
      isConnected: boolean;
    }>(WsEvent.DevicesStatusChanged).subscribe((update) => {
      const ws = this.workstations.find((w) => w.id === update.workstationId);
      if (!ws) return;
      const device = ws.devices.find((d) => d.providerType === update.providerType);
      if (device) {
        device.isConnected = update.isConnected;
      } else {
        ws.devices.push({
          providerType: update.providerType,
          isConnected: update.isConnected,
          agentVersion: null,
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
  }

  loadWorkstations(): void {
    this.loading = true;
    this.wsApi.getAll().subscribe({
      next: (list) => {
        this.workstations = list;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  openCreateDialog(): void {
    this.editingWorkstation = null;
    this.formGroup.reset({ displayName: '', code: '', description: '', defaultCardTemplateId: '' });
    this.selectedRoleIds.clear();
    this.allRoles = [];
    this.cardTemplates = [];
    this.wsApi.getAvailableRoles().subscribe({
      next: (roles) => { this.allRoles = roles; },
      error: () => { this.allRoles = []; },
    });
    this.cardTemplateApi.getAll().subscribe({
      next: (templates) => { this.cardTemplates = templates; },
      error: () => { this.cardTemplates = []; },
    });
    this.showFormDialog = true;
  }

  openEditDialog(ws: WorkstationListItem): void {
    this.editingWorkstation = ws;
    this.formGroup.patchValue({
      displayName: ws.displayName,
      description: ws.description || '',
      defaultCardTemplateId: ws.defaultCardTemplateId || '',
    });
    this.selectedRoleIds.clear();
    this.allRoles = [];
    this.cardTemplates = [];
    this.wsApi.getAvailableRoles().subscribe({
      next: (roles) => { this.allRoles = roles; },
      error: () => { this.allRoles = []; },
    });
    this.cardTemplateApi.getAll().subscribe({
      next: (templates) => { this.cardTemplates = templates; },
      error: () => { this.cardTemplates = []; },
    });
    this.wsApi.getById(ws.id).subscribe((detail) => {
      detail.assignedRoleIds.forEach((id) => this.selectedRoleIds.add(id));
      if (detail.workstation.defaultCardTemplateId) {
        this.formGroup.patchValue({ defaultCardTemplateId: detail.workstation.defaultCardTemplateId });
      }
    });
    this.showFormDialog = true;
  }

  saveWorkstation(): void {
    if (this.formGroup.invalid) return;
    this.saving = true;

    if (this.editingWorkstation) {
      const { code, ...updatePayload } = this.formGroup.value;
      updatePayload.defaultCardTemplateId = updatePayload.defaultCardTemplateId || null;
      const wsId = this.editingWorkstation.id;
      this.wsApi.update(wsId, updatePayload).subscribe({
        next: () => {
          this.wsApi.assignRoles(wsId, [...this.selectedRoleIds]).subscribe({
            next: () => {
              this.saving = false;
              this.showFormDialog = false;
              this.notify.success(this.translate.instant('COMMON.SAVE_SUCCESS'));
              this.loadWorkstations();
            },
            error: () => { this.saving = false; },
          });
        },
        error: () => { this.saving = false; },
      });
    } else {
      const payload = { ...this.formGroup.value };
      payload.defaultCardTemplateId = payload.defaultCardTemplateId || undefined;
      if (!payload.code) {
        const base = payload.displayName
          .toUpperCase()
          .replace(/\s+/g, '-')
          .replace(/[^A-Z0-9\-_]/g, '')
          .substring(0, 92);
        const suffix = Date.now().toString(36).toUpperCase().slice(-6);
        payload.code = `${base}-${suffix}`;
      }
      this.wsApi.create(payload).subscribe({
        next: (created) => {
          if (this.selectedRoleIds.size > 0) {
            this.wsApi.assignRoles(created.id, [...this.selectedRoleIds]).subscribe({
              next: () => {
                this.saving = false;
                this.showFormDialog = false;
                this.notify.success(this.translate.instant('COMMON.SAVE_SUCCESS'));
                this.loadWorkstations();
              },
              error: () => { this.saving = false; },
            });
          } else {
            this.saving = false;
            this.showFormDialog = false;
            this.notify.success(this.translate.instant('COMMON.SAVE_SUCCESS'));
            this.loadWorkstations();
          }
        },
        error: () => { this.saving = false; },
      });
    }
  }

  toggleRoleId(id: string): void {
    this.selectedRoleIds.has(id) ? this.selectedRoleIds.delete(id) : this.selectedRoleIds.add(id);
  }

  openEnrollDialog(ws: WorkstationListItem): void {
    this.enrollTarget = ws;
    this.generatedToken = null;
    this.tokenExpiresAt = null;
    this.enrollProviderType = 'printer';
    this.showEnrollDialog = true;
  }

  generateToken(): void {
    if (!this.enrollTarget) return;
    this.enrollGenerating = true;

    this.wsApi.createEnrollmentToken(this.enrollTarget.id, this.enrollProviderType).subscribe({
      next: (resp) => {
        this.generatedToken = resp.token;
        this.tokenExpiresAt = new Date(resp.expiresAt).toLocaleString();
        this.enrollGenerating = false;
      },
      error: () => { this.enrollGenerating = false; },
    });
  }

  async onDelete(ws: WorkstationListItem): Promise<void> {
    if (!await this.confirmService.confirm('WORKSTATIONS.CONFIRM_DELETE')) return;

    this.wsApi.delete(ws.id).subscribe({
      next: () => {
        this.notify.success(this.translate.instant('COMMON.DELETE_SUCCESS'));
        this.loadWorkstations();
      },
    });
  }
}
