import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { AccessControlApiService } from '../../services/access-control-api.service';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { AcController, Door, Extension, DoorIo, ExtensionIo } from '@core/models/entities.model';

@Component({
  selector: 'app-controller-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TableModule, DialogModule, InputSwitchModule, HasPermissionDirective],
  template: `
    <div class="page-header">
      <div class="header-left">
        <button class="btn btn-secondary btn-back" (click)="router.navigate(['/access-control/controllers'])">
          <i class="pi pi-arrow-left"></i>
          {{ 'COMMON.BACK' | translate }}
        </button>
        <h1>{{ controller?.name }}</h1>
      </div>
      <div class="header-actions" *hasPermission="'access-control.update'">
        <button class="btn btn-primary" (click)="openEditControllerDialog()">
          <i class="pi pi-pencil"></i> {{ 'COMMON.EDIT' | translate }}
        </button>
      </div>
    </div>

    @if (loading) {
      <div class="card loading-card">
        <i class="pi pi-spin pi-spinner"></i> {{ 'COMMON.LOADING' | translate }}
      </div>
    } @else if (controller) {
      <!-- Controller Info Card -->
      <div class="card info-card">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ 'ACCESS_CONTROL.CONTROLLER_NAME' | translate }}</span>
            <span class="info-value">{{ controller.name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ 'ACCESS_CONTROL.TYPE' | translate }}</span>
            <span class="info-value">{{ controller.type }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ 'ACCESS_CONTROL.MODEL' | translate }}</span>
            <span class="info-value">{{ controller.model ?? '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ 'ACCESS_CONTROL.IP_ADDRESS' | translate }}</span>
            <span class="info-value"><code>{{ controller.ip ?? '-' }}</code></span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ 'ACCESS_CONTROL.PORT' | translate }}</span>
            <span class="info-value">{{ controller.port }}</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-bar">
        <button class="tab-btn" [class.active]="activeTab === 'doors'" (click)="activeTab = 'doors'">
          <i class="pi pi-building"></i>
          {{ 'ACCESS_CONTROL.DOORS' | translate }}
          <span class="badge">{{ controller.doors.length }}</span>
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'extensions'" (click)="activeTab = 'extensions'">
          <i class="pi pi-box"></i>
          {{ 'ACCESS_CONTROL.EXTENSIONS' | translate }}
          <span class="badge">{{ controller.extensions.length }}</span>
        </button>
      </div>

      <!-- Doors Tab -->
      @if (activeTab === 'doors') {
        <div class="section-actions" *hasPermission="'access-control.create'">
          <button class="btn btn-primary btn-sm" (click)="openDoorDialog()">
            <i class="pi pi-plus"></i> {{ 'ACCESS_CONTROL.ADD_DOOR' | translate }}
          </button>
        </div>
        <div class="card table-card">
          <p-table
            [value]="controller.doors"
            dataKey="id"
            [expandedRowKeys]="expandedDoorRows"
            styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
          >
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 3rem"></th>
                <th>{{ 'ACCESS_CONTROL.DOOR_NAME' | translate }}</th>
                <th>{{ 'ACCESS_CONTROL.DOOR_INDEX' | translate }}</th>
                <th>{{ 'ACCESS_CONTROL.ENTRY_TYPE' | translate }}</th>
                <th>{{ 'COMMON.ACTIVE' | translate }}</th>
                <th>{{ 'ACCESS_CONTROL.DOOR_IOS' | translate }}</th>
                <th style="width: 7rem">{{ 'COMMON.ACTIONS' | translate }}</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-door let-expanded="expanded">
              <tr>
                <td>
                  <button type="button" class="btn-icon expand-btn" [pRowToggler]="door"
                    [class.expanded]="expanded">
                    <i class="pi" [ngClass]="expanded ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
                  </button>
                </td>
                <td class="name-cell">{{ door.name }}</td>
                <td>{{ door.doorsIndex }}</td>
                <td>{{ entryTypeLabel(door.entryType) }}</td>
                <td>
                  <p-inputSwitch [(ngModel)]="door.isActive" (onChange)="toggleDoorActive(door)"></p-inputSwitch>
                </td>
                <td>
                  <span class="io-count" (click)="toggleDoorRow(door)">
                    <i class="pi pi-sitemap"></i> {{ door.doorIos?.length ?? 0 }}
                  </span>
                </td>
                <td class="actions">
                  <button class="btn-icon" *hasPermission="'access-control.update'" (click)="openDoorDialog(door)" [title]="'COMMON.EDIT' | translate"><i class="pi pi-pencil"></i></button>
                  <button class="btn-icon danger" *hasPermission="'access-control.delete'" (click)="deleteDoor(door)" [title]="'COMMON.DELETE' | translate"><i class="pi pi-trash"></i></button>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="rowexpansion" let-door>
              <tr>
                <td colspan="7" class="expansion-cell">
                  <div class="nested-section">
                    <div class="nested-header">
                      <i class="pi pi-sitemap"></i>
                      {{ 'ACCESS_CONTROL.DOOR_IOS' | translate }}
                      <span class="nested-count">({{ (doorIoMap[door.id] || []).length }})</span>
                      <button class="btn btn-primary btn-xs" *hasPermission="'access-control.create'" (click)="openDoorIoDialog(door.id)">
                        <i class="pi pi-plus"></i> {{ 'COMMON.ADD' | translate }}
                      </button>
                    </div>
                    @if (doorIoMap[door.id]) {
                      <table class="nested-table">
                        <thead>
                          <tr>
                            <th>{{ 'ACCESS_CONTROL.IO_NAME' | translate }}</th>
                            <th>{{ 'ACCESS_CONTROL.IO_TYPE' | translate }}</th>
                            <th>{{ 'ACCESS_CONTROL.IO_INDEX' | translate }}</th>
                            <th>{{ 'ACCESS_CONTROL.IO_STATE' | translate }}</th>
                            <th>{{ 'COMMON.ACTIVE' | translate }}</th>
                            <th style="width: 6rem">{{ 'COMMON.ACTIONS' | translate }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (io of doorIoMap[door.id]; track io.id) {
                            <tr>
                              <td>{{ io.name }}</td>
                              <td>{{ io.type }}</td>
                              <td>{{ io.ioIndex }}</td>
                              <td>{{ io.ioState }}</td>
                              <td>
                                <p-inputSwitch [(ngModel)]="io.isActive" (onChange)="toggleDoorIoActive(door.id, io)"></p-inputSwitch>
                              </td>
                              <td class="actions">
                                <button class="btn-icon" *hasPermission="'access-control.update'" (click)="openDoorIoDialog(door.id, io)" [title]="'COMMON.EDIT' | translate"><i class="pi pi-pencil"></i></button>
                                <button class="btn-icon danger" *hasPermission="'access-control.delete'" (click)="deleteDoorIo(door.id, io)" [title]="'COMMON.DELETE' | translate"><i class="pi pi-trash"></i></button>
                              </td>
                            </tr>
                          }
                          @if (doorIoMap[door.id].length === 0) {
                            <tr><td colspan="6" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
                          }
                        </tbody>
                      </table>
                    } @else {
                      <div class="nested-loading">
                        <i class="pi pi-spin pi-spinner"></i> {{ 'COMMON.LOADING' | translate }}
                      </div>
                    }
                  </div>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr><td colspan="8" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
            </ng-template>
          </p-table>
        </div>
      }

      <!-- Extensions Tab -->
      @if (activeTab === 'extensions') {
        <div class="section-actions" *hasPermission="'access-control.create'">
          <button class="btn btn-primary btn-sm" (click)="openExtDialog()">
            <i class="pi pi-plus"></i> {{ 'ACCESS_CONTROL.ADD_EXTENSION' | translate }}
          </button>
        </div>
        <div class="card table-card">
          <p-table
            [value]="controller.extensions"
            dataKey="id"
            [expandedRowKeys]="expandedExtRows"
            styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
          >
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 3rem"></th>
                <th>{{ 'ACCESS_CONTROL.EXTENSION_NAME' | translate }}</th>
                <th>{{ 'ACCESS_CONTROL.TYPE' | translate }}</th>
                <th>{{ 'ACCESS_CONTROL.EXTENSION_INDEX' | translate }}</th>
                <th>{{ 'COMMON.ACTIVE' | translate }}</th>
                <th>{{ 'ACCESS_CONTROL.EXTENSION_IOS' | translate }}</th>
                <th style="width: 7rem">{{ 'COMMON.ACTIONS' | translate }}</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-ext let-expanded="expanded">
              <tr>
                <td>
                  <button type="button" class="btn-icon expand-btn" [pRowToggler]="ext"
                    [class.expanded]="expanded">
                    <i class="pi" [ngClass]="expanded ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
                  </button>
                </td>
                <td class="name-cell">{{ ext.name }}</td>
                <td>{{ ext.type }}</td>
                <td>{{ ext.extensionIndex }}</td>
                <td>
                  <p-inputSwitch [(ngModel)]="ext.isActive" (onChange)="toggleExtActive(ext)"></p-inputSwitch>
                </td>
                <td>
                  <span class="io-count" (click)="toggleExtRow(ext)">
                    <i class="pi pi-sitemap"></i> {{ ext.extensionIos?.length ?? 0 }}
                  </span>
                </td>
                <td class="actions">
                  <button class="btn-icon" *hasPermission="'access-control.update'" (click)="openExtDialog(ext)" [title]="'COMMON.EDIT' | translate"><i class="pi pi-pencil"></i></button>
                  <button class="btn-icon danger" *hasPermission="'access-control.delete'" (click)="deleteExt(ext)" [title]="'COMMON.DELETE' | translate"><i class="pi pi-trash"></i></button>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="rowexpansion" let-ext>
              <tr>
                <td colspan="8" class="expansion-cell">
                  <div class="nested-section">
                    <div class="nested-header">
                      <i class="pi pi-sitemap"></i>
                      {{ 'ACCESS_CONTROL.EXTENSION_IOS' | translate }}
                      <span class="nested-count">({{ (extIoMap[ext.id] || []).length }})</span>
                      <button class="btn btn-primary btn-xs" *hasPermission="'access-control.create'" (click)="openExtIoDialog(ext.id)">
                        <i class="pi pi-plus"></i> {{ 'COMMON.ADD' | translate }}
                      </button>
                    </div>
                    @if (extIoMap[ext.id]) {
                      <table class="nested-table">
                        <thead>
                          <tr>
                            <th>{{ 'ACCESS_CONTROL.IO_NAME' | translate }}</th>
                            <th>{{ 'ACCESS_CONTROL.IO_TYPE' | translate }}</th>
                            <th>{{ 'ACCESS_CONTROL.IO_INDEX' | translate }}</th>
                            <th>{{ 'ACCESS_CONTROL.IO_STATE' | translate }}</th>
                            <th>{{ 'COMMON.ACTIVE' | translate }}</th>
                            <th style="width: 6rem">{{ 'COMMON.ACTIONS' | translate }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (io of extIoMap[ext.id]; track io.id) {
                            <tr>
                              <td>{{ io.name }}</td>
                              <td>{{ io.type }}</td>
                              <td>{{ io.ioIndex }}</td>
                              <td>{{ io.ioState }}</td>
                              <td>
                                <p-inputSwitch [(ngModel)]="io.isActive" (onChange)="toggleExtIoActive(ext.id, io)"></p-inputSwitch>
                              </td>
                              <td class="actions">
                                <button class="btn-icon" *hasPermission="'access-control.update'" (click)="openExtIoDialog(ext.id, io)" [title]="'COMMON.EDIT' | translate"><i class="pi pi-pencil"></i></button>
                                <button class="btn-icon danger" *hasPermission="'access-control.delete'" (click)="deleteExtIo(ext.id, io)" [title]="'COMMON.DELETE' | translate"><i class="pi pi-trash"></i></button>
                              </td>
                            </tr>
                          }
                          @if (extIoMap[ext.id].length === 0) {
                            <tr><td colspan="6" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
                          }
                        </tbody>
                      </table>
                    } @else {
                      <div class="nested-loading">
                        <i class="pi pi-spin pi-spinner"></i> {{ 'COMMON.LOADING' | translate }}
                      </div>
                    }
                  </div>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr><td colspan="8" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
            </ng-template>
          </p-table>
        </div>
      }
    }

    <!-- Door Dialog -->
    <p-dialog [header]="editingDoor ? ('ACCESS_CONTROL.EDIT_DOOR' | translate) : ('ACCESS_CONTROL.ADD_DOOR' | translate)"
      [(visible)]="showDoorDialog" (onHide)="onDoorDialogHide()" [modal]="true" [style]="{width: '480px'}" [draggable]="false">
      @if (showDoorDialog) {
      <div class="dialog-form">
        <div class="field"><label>{{ 'ACCESS_CONTROL.DOOR_NAME' | translate }} <span class="required">*</span></label>
          <input type="text" [(ngModel)]="doorForm.name" required #doorNameField="ngModel" [placeholder]="'PLACEHOLDER.ENTER_DOOR_NAME' | translate" />
          @if (doorNameField.invalid && doorNameField.touched) {
            <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
          }
        </div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.DOOR_INDEX' | translate }}</label>
          <input type="number" [(ngModel)]="doorForm.doorsIndex" [placeholder]="'PLACEHOLDER.ENTER_DOOR_INDEX' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.ENTRY_TYPE' | translate }}</label>
          <select [(ngModel)]="doorForm.entryType">
            <option [ngValue]="0">{{ 'ACCESS_CONTROL.ENTRY_NONE' | translate }}</option>
            <option [ngValue]="1">{{ 'ACCESS_CONTROL.ENTRY_IN' | translate }}</option>
            <option [ngValue]="2">{{ 'ACCESS_CONTROL.ENTRY_OUT' | translate }}</option>
          </select></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.EXTERNAL_ID' | translate }}</label>
          <input type="text" [(ngModel)]="doorForm.externalId" [placeholder]="'PLACEHOLDER.ENTER_EXTERNAL_ID' | translate" /></div>
      </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showDoorDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="saveDoor()" [disabled]="!doorForm.name || saving">{{ 'COMMON.SAVE' | translate }}</button>
      </ng-template>
    </p-dialog>

    <!-- Extension Dialog -->
    <p-dialog [header]="editingExt ? ('ACCESS_CONTROL.EDIT_EXTENSION' | translate) : ('ACCESS_CONTROL.ADD_EXTENSION' | translate)"
      [(visible)]="showExtDialog" (onHide)="onExtDialogHide()" [modal]="true" [style]="{width: '480px'}" [draggable]="false">
      @if (showExtDialog) {
      <div class="dialog-form">
        <div class="field"><label>{{ 'ACCESS_CONTROL.EXTENSION_NAME' | translate }} <span class="required">*</span></label>
          <input type="text" [(ngModel)]="extForm.name" required #extNameField="ngModel" [placeholder]="'PLACEHOLDER.ENTER_EXTENSION_NAME' | translate" />
          @if (extNameField.invalid && extNameField.touched) {
            <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
          }
        </div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.TYPE' | translate }}</label>
          <input type="number" [(ngModel)]="extForm.type" [placeholder]="'PLACEHOLDER.ENTER_TYPE' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.EXTENSION_INDEX' | translate }}</label>
          <input type="number" [(ngModel)]="extForm.extensionIndex" [placeholder]="'PLACEHOLDER.ENTER_EXTENSION_INDEX' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.EXTERNAL_ID' | translate }}</label>
          <input type="text" [(ngModel)]="extForm.externalId" [placeholder]="'PLACEHOLDER.ENTER_EXTERNAL_ID' | translate" /></div>
      </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showExtDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="saveExt()" [disabled]="!extForm.name || saving">{{ 'COMMON.SAVE' | translate }}</button>
      </ng-template>
    </p-dialog>

    <!-- Door IO Dialog -->
    <p-dialog [header]="editingDoorIo ? ('ACCESS_CONTROL.EDIT_IO' | translate) : ('ACCESS_CONTROL.ADD_IO' | translate)"
      [(visible)]="showDoorIoDialog" (onHide)="onDoorIoDialogHide()" [modal]="true" [style]="{width: '480px'}" [draggable]="false">
      @if (showDoorIoDialog) {
      <div class="dialog-form">
        <div class="field"><label>{{ 'ACCESS_CONTROL.IO_NAME' | translate }} <span class="required">*</span></label>
          <input type="text" [(ngModel)]="doorIoForm.name" required #doorIoNameField="ngModel" [placeholder]="'PLACEHOLDER.ENTER_IO_NAME' | translate" />
          @if (doorIoNameField.invalid && doorIoNameField.touched) {
            <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
          }
        </div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.IO_TYPE' | translate }}</label>
          <input type="number" [(ngModel)]="doorIoForm.type" [placeholder]="'PLACEHOLDER.ENTER_IO_TYPE' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.IO_INDEX' | translate }}</label>
          <input type="number" [(ngModel)]="doorIoForm.ioIndex" [placeholder]="'PLACEHOLDER.ENTER_IO_INDEX' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.IO_STATE' | translate }}</label>
          <input type="number" [(ngModel)]="doorIoForm.ioState" [placeholder]="'PLACEHOLDER.ENTER_IO_STATE' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.EXTERNAL_ID' | translate }}</label>
          <input type="text" [(ngModel)]="doorIoForm.externalId" [placeholder]="'PLACEHOLDER.ENTER_EXTERNAL_ID' | translate" /></div>
      </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showDoorIoDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="saveDoorIo()" [disabled]="!doorIoForm.name || saving">{{ 'COMMON.SAVE' | translate }}</button>
      </ng-template>
    </p-dialog>

    <!-- Extension IO Dialog -->
    <p-dialog [header]="editingExtIo ? ('ACCESS_CONTROL.EDIT_IO' | translate) : ('ACCESS_CONTROL.ADD_IO' | translate)"
      [(visible)]="showExtIoDialog" (onHide)="onExtIoDialogHide()" [modal]="true" [style]="{width: '480px'}" [draggable]="false">
      @if (showExtIoDialog) {
      <div class="dialog-form">
        <div class="field"><label>{{ 'ACCESS_CONTROL.IO_NAME' | translate }} <span class="required">*</span></label>
          <input type="text" [(ngModel)]="extIoForm.name" required #extIoNameField="ngModel" [placeholder]="'PLACEHOLDER.ENTER_IO_NAME' | translate" />
          @if (extIoNameField.invalid && extIoNameField.touched) {
            <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
          }
        </div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.IO_TYPE' | translate }}</label>
          <input type="number" [(ngModel)]="extIoForm.type" [placeholder]="'PLACEHOLDER.ENTER_IO_TYPE' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.IO_INDEX' | translate }}</label>
          <input type="number" [(ngModel)]="extIoForm.ioIndex" [placeholder]="'PLACEHOLDER.ENTER_IO_INDEX' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.IO_STATE' | translate }}</label>
          <input type="number" [(ngModel)]="extIoForm.ioState" [placeholder]="'PLACEHOLDER.ENTER_IO_STATE' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.EXTERNAL_ID' | translate }}</label>
          <input type="text" [(ngModel)]="extIoForm.externalId" [placeholder]="'PLACEHOLDER.ENTER_EXTERNAL_ID' | translate" /></div>
      </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showExtIoDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="saveExtIo()" [disabled]="!extIoForm.name || saving">{{ 'COMMON.SAVE' | translate }}</button>
      </ng-template>
    </p-dialog>

    <!-- Edit Controller Dialog -->
    <p-dialog [header]="'ACCESS_CONTROL.EDIT_CONTROLLER' | translate"
      [(visible)]="showEditControllerDialog" (onHide)="onEditControllerDialogHide()" [modal]="true" [style]="{width: '520px'}" [draggable]="false">
      @if (showEditControllerDialog) {
      <div class="dialog-form">
        <div class="field"><label>{{ 'ACCESS_CONTROL.CONTROLLER_NAME' | translate }} <span class="required">*</span></label>
          <input type="text" [(ngModel)]="controllerForm.name" required #ctrlNameField="ngModel" [placeholder]="'PLACEHOLDER.ENTER_CONTROLLER_NAME' | translate" />
          @if (ctrlNameField.invalid && ctrlNameField.touched) {
            <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
          }
        </div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.TYPE' | translate }}</label>
          <input type="number" [(ngModel)]="controllerForm.type" [placeholder]="'PLACEHOLDER.ENTER_TYPE' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.MODEL' | translate }}</label>
          <input type="text" [(ngModel)]="controllerForm.model" [placeholder]="'PLACEHOLDER.ENTER_MODEL' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.IP_ADDRESS' | translate }}</label>
          <input type="text" [(ngModel)]="controllerForm.ip" [placeholder]="'PLACEHOLDER.ENTER_IP' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.PORT' | translate }}</label>
          <input type="number" [(ngModel)]="controllerForm.port" [placeholder]="'PLACEHOLDER.ENTER_PORT' | translate" /></div>
        <div class="field"><label>{{ 'ACCESS_CONTROL.EXTERNAL_ID' | translate }}</label>
          <input type="text" [(ngModel)]="controllerForm.externalId" [placeholder]="'PLACEHOLDER.ENTER_EXTERNAL_ID' | translate" /></div>
      </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showEditControllerDialog = false">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="saveController()" [disabled]="!controllerForm.name || saving">{{ 'COMMON.SAVE' | translate }}</button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host { display: block; }
    .header-left { display: flex; align-items: center; gap: 1rem; }
    .header-left h1 { margin: 0; }
    .btn-back { gap: 0.4rem; }
    .info-card { margin-bottom: 1.5rem; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem 2rem; }
    .info-item { display: flex; flex-direction: column; gap: 0.25rem; }
    .info-label { font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); }
    .info-value { font-size: 0.9rem; color: var(--color-text); font-weight: 500; }
    .info-value code { background: var(--color-primary-wash); padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.85rem; color: var(--color-primary); }
    .loading-card { display: flex; align-items: center; gap: 0.75rem; color: var(--color-text-muted); font-size: 0.9rem; }
    .status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.78rem; font-weight: 600; background: var(--color-primary-wash); color: var(--color-text-secondary); }
    .status-badge[data-status="Online"] { background: #e8f5e9; color: #2e7d32; }
    .status-badge[data-status="Offline"] { background: #ffebee; color: #c62828; }
    .status-badge[data-status="Error"] { background: #fff8e1; color: #f57f17; }
    .tabs-bar { display: flex; gap: 0.25rem; margin-bottom: 0.75rem; border-bottom: 2px solid var(--color-border-light); }
    .tab-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.7rem 1.25rem; border: none; background: transparent; color: var(--color-text-muted); font-weight: 600; font-size: 0.875rem; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; font-family: inherit; }
    .tab-btn:hover { color: var(--color-primary); background: var(--color-primary-wash); }
    .tab-btn.active { color: var(--color-accent); border-bottom-color: var(--color-accent); }
    .badge { background: var(--color-primary-wash); color: var(--color-text-secondary); padding: 0.1rem 0.55rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700; }
    .tab-btn.active .badge { background: rgba(108,99,255,0.12); color: var(--color-accent); }
    .section-actions { display: flex; justify-content: flex-end; margin-bottom: 0.75rem; }
    .btn-sm { padding: 0.4rem 0.9rem; font-size: 0.82rem; }
    .btn-xs { padding: 0.25rem 0.6rem; font-size: 0.75rem; margin-inline-start: auto; }
    .table-card { padding: 0 !important; overflow: hidden; }
    .expand-btn { width: 28px; height: 28px; }
    .expand-btn i { font-size: 0.8rem; }
    .name-cell { font-weight: 500; }
    .io-count { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); font-weight: 500; color: var(--color-accent); transition: background 0.2s; }
    .io-count:hover { background: rgba(108,99,255,0.08); }
    .expansion-cell { padding: 0 !important; background: var(--color-bg) !important; }
    .nested-section { margin: 0.75rem 1rem 0.75rem 2.5rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); overflow: hidden; }
    .nested-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1rem; font-weight: 600; font-size: 0.82rem; color: var(--color-primary); background: var(--color-surface-alt); border-bottom: 1px solid var(--color-border-light); }
    .nested-count { color: var(--color-text-muted); font-weight: 400; }
    .nested-loading { padding: 1rem; color: var(--color-text-muted); font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; }
    .nested-table { width: 100%; border-collapse: collapse; }
    .nested-table th { padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); background: var(--color-surface-alt); border-bottom: 1px solid var(--color-border-light); text-align: start; }
    .nested-table td { padding: 0.5rem 1rem; font-size: 0.85rem; border-bottom: 1px solid var(--color-border-light); text-align: start; }
    .nested-table tbody tr:last-child td { border-bottom: none; }
    .nested-table tbody tr:hover { background: var(--color-primary-wash); }
    .io-type-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .io-type-badge[data-type="Input"] { background: #e3f2fd; color: #1565c0; }
    .io-type-badge[data-type="Output"] { background: #fce4ec; color: #c62828; }
    .empty { text-align: center; color: var(--color-text-muted); padding: 2rem !important; font-size: 0.88rem; }
    .actions { display: flex; gap: 0.3rem; align-items: center; }
    .dialog-form { display: flex; flex-direction: column; gap: 1rem; }
    .dialog-form .field { display: flex; flex-direction: column; gap: 0.3rem; }
    .dialog-form .field label { font-weight: 500; font-size: 0.85rem; color: var(--color-text-secondary); }

    @media (max-width: 991px) { .info-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 575px) { .info-grid { grid-template-columns: 1fr; } .nested-section { margin-left: 0.5rem; } }
  `],
})
export class ControllerDetailComponent implements OnInit {
  private acApi = inject(AccessControlApiService);
  private route = inject(ActivatedRoute);
  private notify = inject(NotificationService);
  private confirmService = inject(ConfirmService);
  router = inject(Router);

  controllerId = '';
  controller: AcController | null = null;
  loading = true;
  saving = false;
  activeTab: 'doors' | 'extensions' = 'doors';

  expandedDoorRows: { [key: string]: boolean } = {};
  expandedExtRows: { [key: string]: boolean } = {};
  doorIoMap: { [doorId: string]: DoorIo[] } = {};
  extIoMap: { [extId: string]: ExtensionIo[] } = {};

  // Door dialog
  showDoorDialog = false;
  editingDoor: Door | null = null;
  doorForm = { name: '', doorsIndex: 0 as number, entryType: 0 as number, externalId: '' };

  // Extension dialog
  showExtDialog = false;
  editingExt: Extension | null = null;
  extForm = { name: '', type: 0 as number, extensionIndex: 0 as number, externalId: '' };

  // Door IO dialog
  showDoorIoDialog = false;
  editingDoorIo: DoorIo | null = null;
  doorIoParentId = '';
  doorIoForm = { name: '', type: 0 as number, ioIndex: 0 as number, ioState: 0 as number, externalId: '' };

  // Extension IO dialog
  showExtIoDialog = false;
  editingExtIo: ExtensionIo | null = null;
  extIoParentId = '';
  extIoForm = { name: '', type: 0 as number, ioIndex: 0 as number, ioState: 0 as number, externalId: '' };

  // Edit controller dialog
  showEditControllerDialog = false;
  controllerForm = { name: '', type: 0 as number, model: '', ip: '', port: 0 as number, externalId: '' };

  ngOnInit(): void {
    this.controllerId = this.route.snapshot.params['id'];
    this.loadController();
  }

  openEditControllerDialog(): void {
    if (!this.controller) return;
    this.controllerForm = {
      name: this.controller.name,
      type: this.controller.type ?? 0,
      model: this.controller.model ?? '',
      ip: this.controller.ip ?? '',
      port: this.controller.port ?? 0,
      externalId: this.controller.externalId ?? '',
    };
    this.showEditControllerDialog = true;
  }

  saveController(): void {
    if (!this.controllerForm.name) return;
    this.saving = true;
    this.acApi.updateController(this.controllerId, this.controllerForm).subscribe({
      next: () => {
        this.saving = false;
        this.showEditControllerDialog = false;
        this.notify.success('COMMON.SAVE_SUCCESS');
        this.loadController();
      },
      error: () => {
        this.saving = false;
        this.notify.error('COMMON.SAVE_ERROR');
      },
    });
  }

  private loadController(): void {
    this.loading = true;
    this.acApi.getControllerById(this.controllerId).subscribe({
      next: (controller) => {
        this.controller = controller;
        this.loading = false;
        this.doorIoMap = {};
        this.extIoMap = {};
        for (const door of controller.doors ?? []) {
          if (door.doorIos) this.doorIoMap[door.id] = door.doorIos;
        }
        for (const ext of controller.extensions ?? []) {
          if (ext.extensionIos) this.extIoMap[ext.id] = ext.extensionIos;
        }
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/access-control/controllers']);
      },
    });
  }

  toggleDoorRow(door: Door): void {
    if (this.expandedDoorRows[door.id]) {
      delete this.expandedDoorRows[door.id];
    } else {
      this.expandedDoorRows[door.id] = true;
      if (!this.doorIoMap[door.id]) {
        this.loadDoorIos(door.id);
      }
    }
  }

  toggleExtRow(ext: Extension): void {
    if (this.expandedExtRows[ext.id]) {
      delete this.expandedExtRows[ext.id];
    } else {
      this.expandedExtRows[ext.id] = true;
      if (!this.extIoMap[ext.id]) {
        this.loadExtIos(ext.id);
      }
    }
  }

  private loadDoorIos(doorId: string): void {
    this.acApi.getDoorIos(doorId).subscribe((ios) => {
      this.doorIoMap[doorId] = ios;
    });
  }

  private loadExtIos(extId: string): void {
    this.acApi.getExtensionIos(extId).subscribe((ios) => {
      this.extIoMap[extId] = ios;
    });
  }

  entryTypeLabel(entryType: number): string {
    switch (entryType) {
      case 1: return 'IN';
      case 2: return 'OUT';
      default: return 'NONE';
    }
  }

  // ===== Toggle Active =====
  toggleDoorActive(door: Door): void {
    this.acApi.updateDoor(door.id, { isActive: door.isActive }).subscribe({
      next: () => this.notify.success('COMMON.SUCCESS'),
      error: (err) => { door.isActive = !door.isActive; this.notify.error(err); },
    });
  }

  toggleExtActive(ext: Extension): void {
    this.acApi.updateExtension(ext.id, { isActive: ext.isActive }).subscribe({
      next: () => this.notify.success('COMMON.SUCCESS'),
      error: (err) => { ext.isActive = !ext.isActive; this.notify.error(err); },
    });
  }

  toggleDoorIoActive(doorId: string, io: DoorIo): void {
    this.acApi.updateDoorIo(io.id, { isActive: io.isActive }).subscribe({
      next: () => this.notify.success('COMMON.SUCCESS'),
      error: (err) => { io.isActive = !io.isActive; this.notify.error(err); },
    });
  }

  toggleExtIoActive(extId: string, io: ExtensionIo): void {
    this.acApi.updateExtensionIo(io.id, { isActive: io.isActive }).subscribe({
      next: () => this.notify.success('COMMON.SUCCESS'),
      error: (err) => { io.isActive = !io.isActive; this.notify.error(err); },
    });
  }

  // ===== Door CRUD =====
  openDoorDialog(door?: Door): void {
    this.editingDoor = door ?? null;
    this.doorForm = door
      ? { name: door.name, doorsIndex: door.doorsIndex, entryType: door.entryType, externalId: door.externalId ?? '' }
      : { name: '', doorsIndex: 0, entryType: 0, externalId: '' };
    this.showDoorDialog = true;
  }

  saveDoor(): void {
    this.saving = true;
    const body = { ...this.doorForm, controllerId: this.controllerId };
    const req$ = this.editingDoor
      ? this.acApi.updateDoor(this.editingDoor.id, body)
      : this.acApi.createDoor(body);
    req$.subscribe({
      next: () => { this.saving = false; this.showDoorDialog = false; this.notify.success('COMMON.SUCCESS'); this.loadController(); },
      error: (err) => { this.saving = false; this.notify.error(err); },
    });
  }

  async deleteDoor(door: Door): Promise<void> {
    if (!await this.confirmService.confirm('ACCESS_CONTROL.DELETE_DOOR_CONFIRM', { name: door.name })) return;
    this.acApi.deleteDoor(door.id).subscribe({
      next: () => { this.notify.success('COMMON.SUCCESS'); this.loadController(); },
      error: (err) => this.notify.error(err),
    });
  }

  // ===== Extension CRUD =====
  openExtDialog(ext?: Extension): void {
    this.editingExt = ext ?? null;
    this.extForm = ext
      ? { name: ext.name, type: ext.type, extensionIndex: ext.extensionIndex, externalId: ext.externalId ?? '' }
      : { name: '', type: 0, extensionIndex: 0, externalId: '' };
    this.showExtDialog = true;
  }

  saveExt(): void {
    this.saving = true;
    const body = { ...this.extForm, controllerId: this.controllerId };
    const req$ = this.editingExt
      ? this.acApi.updateExtension(this.editingExt.id, body)
      : this.acApi.createExtension(body);
    req$.subscribe({
      next: () => { this.saving = false; this.showExtDialog = false; this.notify.success('COMMON.SUCCESS'); this.loadController(); },
      error: (err) => { this.saving = false; this.notify.error(err); },
    });
  }

  async deleteExt(ext: Extension): Promise<void> {
    if (!await this.confirmService.confirm('ACCESS_CONTROL.DELETE_EXTENSION_CONFIRM', { name: ext.name })) return;
    this.acApi.deleteExtension(ext.id).subscribe({
      next: () => { this.notify.success('COMMON.SUCCESS'); this.loadController(); },
      error: (err) => this.notify.error(err),
    });
  }

  // ===== Door IO CRUD =====
  openDoorIoDialog(doorId: string, io?: DoorIo): void {
    this.doorIoParentId = doorId;
    this.editingDoorIo = io ?? null;
    this.doorIoForm = io
      ? { name: io.name, type: io.type, ioIndex: io.ioIndex, ioState: io.ioState, externalId: io.externalId ?? '' }
      : { name: '', type: 0, ioIndex: 0, ioState: 0, externalId: '' };
    this.showDoorIoDialog = true;
  }

  saveDoorIo(): void {
    this.saving = true;
    const body = { ...this.doorIoForm, doorId: this.doorIoParentId };
    const req$ = this.editingDoorIo
      ? this.acApi.updateDoorIo(this.editingDoorIo.id, body)
      : this.acApi.createDoorIo(body);
    req$.subscribe({
      next: () => { this.saving = false; this.showDoorIoDialog = false; this.notify.success('COMMON.SUCCESS'); this.loadDoorIos(this.doorIoParentId); },
      error: (err) => { this.saving = false; this.notify.error(err); },
    });
  }

  async deleteDoorIo(doorId: string, io: DoorIo): Promise<void> {
    if (!await this.confirmService.confirm('ACCESS_CONTROL.DELETE_IO_CONFIRM', { name: io.name })) return;
    this.acApi.deleteDoorIo(io.id).subscribe({
      next: () => { this.notify.success('COMMON.SUCCESS'); this.loadDoorIos(doorId); },
      error: (err) => this.notify.error(err),
    });
  }

  // ===== Extension IO CRUD =====
  openExtIoDialog(extId: string, io?: ExtensionIo): void {
    this.extIoParentId = extId;
    this.editingExtIo = io ?? null;
    this.extIoForm = io
      ? { name: io.name, type: io.type, ioIndex: io.ioIndex, ioState: io.ioState, externalId: io.externalId ?? '' }
      : { name: '', type: 0, ioIndex: 0, ioState: 0, externalId: '' };
    this.showExtIoDialog = true;
  }

  saveExtIo(): void {
    this.saving = true;
    const body = { ...this.extIoForm, extensionId: this.extIoParentId };
    const req$ = this.editingExtIo
      ? this.acApi.updateExtensionIo(this.editingExtIo.id, body)
      : this.acApi.createExtensionIo(body);
    req$.subscribe({
      next: () => { this.saving = false; this.showExtIoDialog = false; this.notify.success('COMMON.SUCCESS'); this.loadExtIos(this.extIoParentId); },
      error: (err) => { this.saving = false; this.notify.error(err); },
    });
  }

  async deleteExtIo(extId: string, io: ExtensionIo): Promise<void> {
    if (!await this.confirmService.confirm('ACCESS_CONTROL.DELETE_IO_CONFIRM', { name: io.name })) return;
    this.acApi.deleteExtensionIo(io.id).subscribe({
      next: () => { this.notify.success('COMMON.SUCCESS'); this.loadExtIos(extId); },
      error: (err) => this.notify.error(err),
    });
  }

  onDoorDialogHide(): void {
    this.doorForm = { name: '', doorsIndex: 0, entryType: 0, externalId: '' };
    this.editingDoor = null;
  }

  onExtDialogHide(): void {
    this.extForm = { name: '', type: 0, extensionIndex: 0, externalId: '' };
    this.editingExt = null;
  }

  onDoorIoDialogHide(): void {
    this.doorIoForm = { name: '', type: 0, ioIndex: 0, ioState: 0, externalId: '' };
    this.editingDoorIo = null;
  }

  onExtIoDialogHide(): void {
    this.extIoForm = { name: '', type: 0, ioIndex: 0, ioState: 0, externalId: '' };
    this.editingExtIo = null;
  }

  onEditControllerDialogHide(): void {
    this.controllerForm = { name: '', type: 0, model: '', ip: '', port: 0, externalId: '' };
  }
}
