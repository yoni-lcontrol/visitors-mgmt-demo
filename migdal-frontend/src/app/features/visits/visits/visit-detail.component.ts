import { Component, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { ApiService } from '@core/api/api.service';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { PermissionService } from '@core/permissions/permission.service';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { ExcelImportService } from '@core/services/excel-import.service';
import { BlacklistCheckService } from '@core/services/blacklist-check.service';
import { VisitorSearchService, VisitorSuggestion } from '@core/services/visitor-search.service';
import { AdSearchService, AdPersonSuggestion } from '@core/services/ad-search.service';
import { SectorsLookupService, SectorLookupItem } from '@core/services/sectors-lookup.service';
import { VisitsApiService } from '../services/visits-api.service';
import { VehicleModelsApiService } from '../../settings/services/vehicle-models-api.service';
import { VisitorPrintService } from '../services/visitor-print.service';
import { DeviceStatusService } from '@core/services/device-status.service';
import { WorkstationSessionService } from '@core/services/workstation-session.service';
import { VisitVisitorsTableComponent } from './visit-visitors-table.component';
import { VisitEscortsTableComponent } from './visit-escorts-table.component';
import { VisitHistoryDialogComponent } from './visit-history-dialog.component';
import { Subject, Subscription, EMPTY } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import {
  Visit,
  VisitVisitor,
  VisitEscort,
  VisitorAccessLogEntry,
  VisitorStatus,
  VisitorAccessEventType,
  InlineVisitor,
  InlineEscort,
} from '@core/models/entities.model';
import { EMAIL_PATTERN } from '@shared/constants/regex.constants';

@Component({
  selector: 'app-visit-detail',
  standalone: true,
  imports: [
    DateFormatPipe,
    TranslateModule,
    FormsModule,
    HasPermissionDirective,
    DialogModule,
    DropdownModule,
    CheckboxModule,
    VisitVisitorsTableComponent,
    VisitEscortsTableComponent,
    VisitHistoryDialogComponent,
  ],
  providers: [VisitorPrintService],
  animations: [
    trigger('slideSection', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-8px)', maxHeight: '0px', overflow: 'hidden' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)', maxHeight: '500px' })),
      ]),
      transition(':leave', [
        style({ opacity: 1, transform: 'translateY(0)', maxHeight: '500px', overflow: 'hidden' }),
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-8px)', maxHeight: '0px' })),
      ]),
    ]),
  ],
  template: `
    <div class="page-header">
      <div class="header-left">
        <button class="btn btn-ghost" (click)="goBack()">
          <i class="pi pi-arrow-left"></i> {{ 'COMMON.BACK' | translate }}
        </button>
        <h1>{{ visit?.title ?? ('COMMON.LOADING' | translate) }}</h1>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" *hasPermission="'visits.create'" (click)="openAddVisitorDialog()">
          <i class="pi pi-user-plus"></i> {{ 'VISITS.ADD_VISITOR' | translate }}
        </button>
        <button class="btn btn-secondary" *hasPermission="'visits.create'" (click)="openAddEscortDialog()">
          <i class="pi pi-shield"></i> {{ 'VISITS.ADD_ESCORT' | translate }}
        </button>
      </div>
    </div>

    @if (visit) {
      <div class="visit-info card">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ 'VISITS.PLANNED_START' | translate }}</span>
            <span class="info-value" dir="ltr">{{ visit.plannedStartTimeUtc | dateFormat }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ 'VISITS.PLANNED_END' | translate }}</span>
            <span class="info-value" dir="ltr">{{ visit.plannedEndTimeUtc | dateFormat }}</span>
          </div>
          @if (visit.purposeOfVisit) {
            <div class="info-item full-width">
              <span class="info-label">{{ 'VISITS.PURPOSE_OF_VISIT' | translate }}</span>
              <span class="info-value">{{ visit.purposeOfVisit }}</span>
            </div>
          }
          @if (visit.sector) {
            <div class="info-item">
              <span class="info-label">{{ 'VISITS.SECTOR' | translate }}</span>
              <span class="info-value">{{ visit.sector.name }}</span>
            </div>
          }
          @if (visit.building) {
            <div class="info-item">
              <span class="info-label">{{ 'BUILDINGS.BUILDING' | translate }}</span>
              <span class="info-value">{{ visit.building.name }}</span>
            </div>
          }
          @if (visit.floor != null) {
            <div class="info-item">
              <span class="info-label">{{ 'VISITS.FLOOR' | translate }}</span>
              <span class="info-value">{{ visit.floor }}</span>
            </div>
          }
          @if (visit.visitRequester) {
            <div class="info-item full-width">
              <span class="info-label">{{ 'VISITS.VISIT_REQUESTER' | translate }}</span>
              <span class="info-value">
                {{ visit.visitRequester.firstName }} {{ visit.visitRequester.lastName }}
                @if (visit.visitRequester.phone) { &middot; {{ visit.visitRequester.phone }} }
                @if (visit.visitRequester.email) { &middot; {{ visit.visitRequester.email }} }
              </span>
            </div>
          }
        </div>
        @if (visit.statusSummary) {
          <div class="summary-bar">
            <span class="summary-item total"><i class="pi pi-users"></i> {{ visit.statusSummary.total }} {{ 'VISITS.TOTAL' | translate }}</span>
            <span class="summary-item pending"><i class="pi pi-clock"></i> {{ visit.statusSummary.pending }} {{ 'VISITS.STATUS_PENDING' | translate }}</span>
            <span class="summary-item arrived"><i class="pi pi-sign-in"></i> {{ visit.statusSummary.arrived }} {{ 'VISITS.STATUS_ARRIVED' | translate }}</span>
            <span class="summary-item checked-in"><i class="pi pi-check-circle"></i> {{ visit.statusSummary.checkedIn }} {{ 'VISITS.STATUS_CHECKED_IN' | translate }}</span>
            <span class="summary-item checked-out"><i class="pi pi-sign-out"></i> {{ visit.statusSummary.checkedOut }} {{ 'VISITS.STATUS_CHECKED_OUT' | translate }}</span>
          </div>
        }
      </div>

      <!-- Visitors Table -->
      <app-visit-visitors-table
        [visitors]="visitors"
        [codeMap]="codeMap"
        [loading]="loadingVisitors"
        [printingVisitorId]="printingVisitorId"
        [printerConnected]="isPrinterConnected"
        (registerEvent)="registerEvent($event.vv, $event.eventType)"
        (editVisitor)="openEditVisitorDialog($event)"
        (resendCode)="resendCheckInCode($event)"
        (regenerateCode)="regenerateCheckInCode($event)"
        (showHistory)="openHistoryDialog($event)"
        (printCard)="printCard($event)"
        (removeVisitor)="removeVisitor($event)"
      />

      <!-- Escorts Table -->
      <app-visit-escorts-table
        [escorts]="escorts"
        [loading]="loadingEscorts"
        (editEscort)="openEditEscortDialog($event)"
        (removeEscort)="removeEscort($event)"
      />

      <!-- Files Section -->
      <div class="card files-section">
        <div class="section-header">
          <h2><i class="pi pi-paperclip"></i> {{ 'VISITS.ATTACHMENTS' | translate }}</h2>
          <button class="btn btn-secondary btn-sm" *hasPermission="'visits.update'" (click)="visitFileInput.click()">
            <i class="pi pi-upload"></i> {{ 'VISITS.UPLOAD_FILE' | translate }}
          </button>
          <input #visitFileInput type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx" (change)="onVisitFilesSelected($event)" style="display:none" />
        </div>
        @if (loadingFiles) {
          <div class="loading-row"><i class="pi pi-spin pi-spinner"></i></div>
        } @else if (visitFiles.length === 0) {
          <div class="empty-state">{{ 'VISITS.NO_FILES' | translate }}</div>
        } @else {
          <div class="file-list">
            @for (f of visitFiles; track f.id) {
              <div class="file-item">
                <i class="pi pi-file"></i>
                <span class="file-name">{{ f.originalName }}</span>
                <span class="file-size">{{ formatFileSize(f.size) }}</span>
                <span class="file-date" dir="ltr">{{ f.createdAt | dateFormat }}</span>
                <button class="btn-icon" (click)="downloadFile(f)" [title]="'COMMON.DOWNLOAD' | translate">
                  <i class="pi pi-download"></i>
                </button>
                <button class="btn-icon danger" *hasPermission="'visits.update'" (click)="deleteFile(f)" [title]="'COMMON.DELETE' | translate">
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            }
          </div>
        }
      </div>
    }

    <!-- Add Visitor Dialog -->
    <p-dialog [header]="'VISITS.ADD_VISITOR' | translate"
      [(visible)]="showAddVisitorDialog" (onHide)="onAddVisitorDialogHide()" [modal]="true" [style]="{width: '700px'}" [draggable]="false">
      @if (showAddVisitorDialog) {
      <div class="dialog-form">
        @for (v of newVisitors; track $index) {
          <div class="inline-row">
            <div class="inline-row-header">
              <span class="inline-row-num">{{ 'VISITS.VISITOR' | translate }} {{ $index + 1 }}</span>
              @if (newVisitors.length > 1) {
                <button class="btn-icon danger" (click)="removeNewVisitor($index)" [title]="'COMMON.DELETE' | translate">
                  <i class="pi pi-times"></i>
                </button>
              }
            </div>
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-id-card"></i> {{ 'VISITORS.PERSON_ID' | translate }} <span class="required">*</span></label>
                <div class="input-wrapper">
                  <input type="text" [(ngModel)]="v.personId" required pattern="[0-9]*" #vPersonId="ngModel"
                    (ngModelChange)="onNewVisitorPersonIdChange($index, $event)"
                    (focus)="onNewPersonIdFocus($index)"
                    (blur)="onNewPersonIdBlur($index)"
                    [class.input-warning]="blacklistMap.get($index)?.blacklisted"
                    [placeholder]="'PLACEHOLDER.ENTER_PERSON_ID' | translate"
                    autocomplete="off" />
                  @if (blacklistMap.get($index)?.checking || searchLoading.get($index)) {
                    <i class="pi pi-spin pi-spinner input-spinner"></i>
                  }
                </div>
                @if (suggestionsVisible.get($index) && visitorSuggestions.get($index)?.length) {
                  <div class="suggestions-panel">
                    @for (s of visitorSuggestions.get($index); track s.id) {
                      <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectNewVisitorSuggestion($index, s)">
                        <div class="suggestion-main">
                          <span class="suggestion-name">{{ s.firstName }} {{ s.lastName }}</span>
                          <span class="suggestion-pid">{{ s.personId }}</span>
                        </div>
                        <div class="suggestion-secondary">
                          @if (s.phone) { <span>{{ s.phone }}</span> }
                          @if (s.email) { <span>{{ s.email }}</span> }
                        </div>
                      </div>
                    }
                  </div>
                } @else if (suggestionsVisible.get($index) && showNoResults.get($index)) {
                  <div class="suggestions-panel">
                    <div class="suggestion-no-results">{{ 'VISITORS.NO_SEARCH_RESULTS' | translate }}</div>
                  </div>
                }
                @if (vPersonId.invalid && vPersonId.touched) {
                  <small class="field-error">
                    @if (vPersonId.errors?.['required']) { {{ 'VALIDATION.REQUIRED' | translate }} }
                    @else if (vPersonId.errors?.['pattern']) { {{ 'VALIDATION.DIGITS_ONLY' | translate }} }
                  </small>
                }
                @if (blacklistMap.get($index)?.blacklisted) {
                  <small class="field-warning"><i class="pi pi-exclamation-triangle"></i> {{ 'VALIDATION.BLACKLISTED_WARNING' | translate }}</small>
                }
                @if (isDuplicateNewPersonId($index)) {
                  <small class="field-warning"><i class="pi pi-exclamation-triangle"></i> {{ 'VALIDATION.DUPLICATE_PERSON_ID' | translate }}</small>
                }
              </div>
              <div class="field">
                <label><i class="pi pi-user"></i> {{ 'VISITS.FIRST_NAME' | translate }} <span class="required">*</span></label>
                <input type="text" [(ngModel)]="v.firstName" required #vFirstName="ngModel" [placeholder]="'PLACEHOLDER.ENTER_FIRST_NAME' | translate" />
                @if (vFirstName.invalid && vFirstName.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-user"></i> {{ 'VISITS.LAST_NAME' | translate }} <span class="required">*</span></label>
                <input type="text" [(ngModel)]="v.lastName" required #vLastName="ngModel" [placeholder]="'PLACEHOLDER.ENTER_LAST_NAME' | translate" />
                @if (vLastName.invalid && vLastName.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
              <div class="field">
                <label><i class="pi pi-phone"></i> {{ 'VISITS.PHONE' | translate }} <span class="required">*</span></label>
                <input type="text" [(ngModel)]="v.phone" required #vPhone="ngModel" [placeholder]="'PLACEHOLDER.ENTER_PHONE' | translate" />
                @if (vPhone.invalid && vPhone.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
                @if (isDuplicateNewPhone($index)) {
                  <small class="field-warning"><i class="pi pi-exclamation-triangle"></i> {{ 'VALIDATION.DUPLICATE_PHONE' | translate }}</small>
                }
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-envelope"></i> {{ 'VISITS.EMAIL' | translate }}</label>
                <input type="email" [(ngModel)]="v.email" [pattern]="emailPattern" #vEmail="ngModel" [placeholder]="'PLACEHOLDER.ENTER_EMAIL' | translate" />
                @if (vEmail.hasError('pattern') && vEmail.touched) {
                  <small class="field-error">{{ 'VALIDATION.EMAIL' | translate }}</small>
                }
              </div>
            </div>
            <div class="field checkbox-field vehicle-toggle">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="v.hasVehicle" (ngModelChange)="onNewVehicleCheckboxChange(v)" />
                <i class="pi pi-car"></i>
                {{ 'VISITORS.HAS_VEHICLE' | translate }}
              </label>
            </div>
            @if (v.hasVehicle) {
              <div class="vehicle-section" @slideSection>
                <div class="form-row">
                  <div class="field">
                    <label><i class="pi pi-car"></i> {{ 'VISITORS.CAR_NUMBER' | translate }} <span class="required">*</span></label>
                    <input type="text" [(ngModel)]="v.carNumber" [placeholder]="'PLACEHOLDER.ENTER_CAR_NUMBER' | translate"
                      [class.input-invalid]="v.hasVehicle && !v.carNumber" />
                    @if (v.hasVehicle && !v.carNumber) {
                      <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                    }
                  </div>
                  <div class="field">
                    <label><i class="pi pi-car"></i> {{ 'VISITORS.VEHICLE_TYPE' | translate }} <span class="required">*</span></label>
                    <p-dropdown [options]="vehicleTypeOptions" [(ngModel)]="v.vehicleType"
                      [group]="true" optionGroupLabel="label" optionGroupChildren="items"
                      optionLabel="label" optionValue="value"
                      [placeholder]="'VISITORS.SELECT_VEHICLE_TYPE' | translate"
                      [filter]="true" filterBy="label"
                      panelStyleClass="vehicle-type-panel"
                      [style]="{width: '100%'}" appendTo="body"
                      [class.input-invalid]="v.hasVehicle && !v.vehicleType"></p-dropdown>
                    @if (v.hasVehicle && !v.vehicleType) {
                      <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                    }
                  </div>
                </div>
                @if (canRequestParking) {
                <div class="field checkbox-field parking-toggle">
                  <label class="checkbox-label">
                    <input type="checkbox" [(ngModel)]="v.requestParking" />
                    <i class="pi pi-warehouse"></i>
                    {{ 'VISITORS.REQUEST_PARKING' | translate }}
                  </label>
                </div>
                }
              </div>
            }
          </div>
        }
        <div class="visitor-actions">
          <button class="btn btn-secondary btn-add-inline" (click)="addNewVisitorRow()">
            <i class="pi pi-plus"></i> {{ 'VISITS.ADD_VISITOR' | translate }}
          </button>
          <button class="btn btn-secondary btn-add-inline" (click)="detailVisitorFileInput.click()">
            <i class="pi pi-file-excel"></i> {{ 'VISITS.IMPORT_VISITORS' | translate }}
          </button>
        </div>
        <input #detailVisitorFileInput type="file" accept=".xlsx,.xls" (change)="onVisitorFileSelected($event)" style="display:none" />
        @if (importErrors.length) {
          <div class="import-errors">
            <div class="import-errors-header">
              <span><i class="pi pi-exclamation-triangle"></i> {{ 'VISITS.IMPORT_ERRORS_TITLE' | translate }}</span>
              <button class="btn-icon" (click)="importErrors = []" [title]="'COMMON.CLOSE' | translate"><i class="pi pi-times"></i></button>
            </div>
            @for (err of importErrors; track $index) {
              <div class="import-error-row">{{ err }}</div>
            }
          </div>
        }
      </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showAddVisitorDialog = false" [disabled]="savingVisitor">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary save-btn" (click)="addVisitors()" [disabled]="!isAddVisitorsValid() || savingVisitor">
          @if (savingVisitor) {
            <i class="pi pi-spin pi-spinner"></i> {{ 'COMMON.SAVING' | translate }}
          } @else {
            <i class="pi pi-save"></i> {{ 'COMMON.SAVE' | translate }}
          }
        </button>
      </ng-template>
    </p-dialog>

    <!-- Add Escort Dialog -->
    <p-dialog [header]="'VISITS.ADD_ESCORT' | translate"
      [(visible)]="showAddEscortDialog" (onHide)="onAddEscortDialogHide()" [modal]="true" [style]="{width: '600px'}" [draggable]="false">
      @if (showAddEscortDialog) {
      <div class="dialog-form">
        @for (e of newEscorts; track $index) {
          <div class="inline-row">
            <div class="inline-row-header">
              <span class="inline-row-num">{{ 'VISITS.ESCORT' | translate }} {{ $index + 1 }}</span>
              @if (newEscorts.length > 1) {
                <button class="btn-icon danger" (click)="removeNewEscort($index)" [title]="'COMMON.DELETE' | translate">
                  <i class="pi pi-times"></i>
                </button>
              }
            </div>
            <div class="form-row">
              <div class="field">
                <label>{{ 'VISITS.FIRST_NAME' | translate }} <span class="required">*</span></label>
                <div class="input-wrapper">
                  <input type="text" [(ngModel)]="e.firstName" required #eFirstName="ngModel"
                    (ngModelChange)="onNewEscortNameChange($index, $event)"
                    (focus)="onNewEscortNameFocus($index, 'first')"
                    (blur)="onNewEscortNameBlur($index)"
                    [placeholder]="'PLACEHOLDER.ENTER_FIRST_NAME' | translate" autocomplete="off" />
                  @if (adEscortLoading.get($index)) {
                    <i class="pi pi-spin pi-spinner input-spinner"></i>
                  }
                </div>
                @if (adEscortVisible.get($index) && adEscortActiveField.get($index) === 'first' && adEscortSuggestions.get($index)?.length) {
                  <div class="suggestions-panel">
                    @for (p of adEscortSuggestions.get($index); track $index) {
                      <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectNewEscortSuggestion($index, p)">
                        <div class="suggestion-main">
                          <span class="suggestion-name">{{ p.displayName || (p.firstName + ' ' + p.lastName) }}</span>
                        </div>
                        <div class="suggestion-secondary">
                          @if (p.email) { <span>{{ p.email }}</span> }
                          @if (p.phone) { <span>{{ p.phone }}</span> }
                        </div>
                      </div>
                    }
                  </div>
                } @else if (adEscortVisible.get($index) && adEscortActiveField.get($index) === 'first' && adEscortError.get($index)) {
                  <div class="suggestions-panel">
                    <div class="suggestion-error"><i class="pi pi-exclamation-circle"></i> {{ adEscortError.get($index)! | translate }}</div>
                  </div>
                } @else if (adEscortVisible.get($index) && adEscortActiveField.get($index) === 'first' && adEscortNoResults.get($index)) {
                  <div class="suggestions-panel">
                    <div class="suggestion-no-results">{{ 'AD_SEARCH.NO_RESULTS' | translate }}</div>
                  </div>
                }
                @if (eFirstName.invalid && eFirstName.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
              <div class="field">
                <label>{{ 'VISITS.LAST_NAME' | translate }} <span class="required">*</span></label>
                <div class="input-wrapper">
                  <input type="text" [(ngModel)]="e.lastName" required #eLastName="ngModel"
                    (ngModelChange)="onNewEscortNameChange($index, $event)"
                    (focus)="onNewEscortNameFocus($index, 'last')"
                    (blur)="onNewEscortNameBlur($index)"
                    [placeholder]="'PLACEHOLDER.ENTER_LAST_NAME' | translate" autocomplete="off" />
                  @if (adEscortLoading.get($index)) {
                    <i class="pi pi-spin pi-spinner input-spinner"></i>
                  }
                </div>
                @if (adEscortVisible.get($index) && adEscortActiveField.get($index) === 'last' && adEscortSuggestions.get($index)?.length) {
                  <div class="suggestions-panel">
                    @for (p of adEscortSuggestions.get($index); track $index) {
                      <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectNewEscortSuggestion($index, p)">
                        <div class="suggestion-main">
                          <span class="suggestion-name">{{ p.displayName || (p.firstName + ' ' + p.lastName) }}</span>
                        </div>
                        <div class="suggestion-secondary">
                          @if (p.email) { <span>{{ p.email }}</span> }
                          @if (p.phone) { <span>{{ p.phone }}</span> }
                        </div>
                      </div>
                    }
                  </div>
                } @else if (adEscortVisible.get($index) && adEscortActiveField.get($index) === 'last' && adEscortError.get($index)) {
                  <div class="suggestions-panel">
                    <div class="suggestion-error"><i class="pi pi-exclamation-circle"></i> {{ adEscortError.get($index)! | translate }}</div>
                  </div>
                } @else if (adEscortVisible.get($index) && adEscortActiveField.get($index) === 'last' && adEscortNoResults.get($index)) {
                  <div class="suggestions-panel">
                    <div class="suggestion-no-results">{{ 'AD_SEARCH.NO_RESULTS' | translate }}</div>
                  </div>
                }
                @if (eLastName.invalid && eLastName.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label>{{ 'VISITS.PHONE' | translate }} <span class="required">*</span></label>
                <input type="text" [(ngModel)]="e.phone" required #ePhone="ngModel" [placeholder]="'PLACEHOLDER.ENTER_PHONE' | translate" />
                @if (ePhone.invalid && ePhone.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
              <div class="field">
                <label>{{ 'VISITS.EMAIL' | translate }} <span class="required">*</span></label>
                <input type="email" [(ngModel)]="e.email" required [pattern]="emailPattern" #eEmail="ngModel" [placeholder]="'PLACEHOLDER.ENTER_EMAIL' | translate" />
                @if (eEmail.hasError('required') && eEmail.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                } @else if (eEmail.hasError('pattern') && eEmail.touched) {
                  <small class="field-error">{{ 'VALIDATION.EMAIL' | translate }}</small>
                }
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label>{{ 'VISITS.SECTOR' | translate }}</label>
                <p-dropdown
                  [options]="escortSectorOptions"
                  [(ngModel)]="e.sector"
                  optionLabel="name"
                  optionValue="name"
                  [placeholder]="'VISITS.SECTOR' | translate"
                  appendTo="body"
                  [style]="{width: '100%'}"
                ></p-dropdown>
              </div>
            </div>
          </div>
        }
        <button class="btn btn-secondary btn-add-inline" (click)="addNewEscortRow()">
          <i class="pi pi-plus"></i> {{ 'VISITS.ADD_ESCORT' | translate }}
        </button>
      </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showAddEscortDialog = false" [disabled]="savingEscort">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary save-btn" (click)="addEscorts()" [disabled]="!isAddEscortsValid() || savingEscort">
          @if (savingEscort) {
            <i class="pi pi-spin pi-spinner"></i> {{ 'COMMON.SAVING' | translate }}
          } @else {
            <i class="pi pi-save"></i> {{ 'COMMON.SAVE' | translate }}
          }
        </button>
      </ng-template>
    </p-dialog>

    <!-- Edit Visitor Dialog -->
    <p-dialog [header]="'VISITS.EDIT_VISITOR' | translate"
      [(visible)]="showEditVisitorDialog" (onHide)="onEditVisitorDialogHide()" [modal]="true" [style]="{width: '700px'}" [draggable]="false">
      @if (showEditVisitorDialog && editingVisitor) {
        <div class="dialog-form">
          <div class="inline-row">
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-id-card"></i> {{ 'VISITORS.PERSON_ID' | translate }} <span class="required">*</span></label>
                <div class="input-wrapper">
                  <input type="text" [(ngModel)]="editingVisitor.personId"
                    (ngModelChange)="onEditVisitorPersonIdChange($event)"
                    (focus)="onEditPersonIdFocus()"
                    (blur)="onEditPersonIdBlur()"
                    [class.input-warning]="editBlacklistStatus?.blacklisted"
                    [placeholder]="'PLACEHOLDER.ENTER_PERSON_ID' | translate"
                    autocomplete="off" />
                  @if (editBlacklistStatus?.checking || editSearchLoading) {
                    <i class="pi pi-spin pi-spinner input-spinner"></i>
                  }
                </div>
                @if (editSuggestionsVisible && editVisitorSuggestions.length) {
                  <div class="suggestions-panel">
                    @for (s of editVisitorSuggestions; track s.id) {
                      <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectEditVisitorSuggestion(s)">
                        <div class="suggestion-main">
                          <span class="suggestion-name">{{ s.firstName }} {{ s.lastName }}</span>
                          <span class="suggestion-pid">{{ s.personId }}</span>
                        </div>
                        <div class="suggestion-secondary">
                          @if (s.phone) { <span>{{ s.phone }}</span> }
                          @if (s.email) { <span>{{ s.email }}</span> }
                        </div>
                      </div>
                    }
                  </div>
                } @else if (editSuggestionsVisible && editShowNoResults) {
                  <div class="suggestions-panel">
                    <div class="suggestion-no-results">{{ 'VISITORS.NO_SEARCH_RESULTS' | translate }}</div>
                  </div>
                }
                @if (editBlacklistStatus?.blacklisted) {
                  <small class="field-warning"><i class="pi pi-exclamation-triangle"></i> {{ 'VALIDATION.BLACKLISTED_WARNING' | translate }}</small>
                }
              </div>
              <div class="field">
                <label><i class="pi pi-user"></i> {{ 'VISITS.FIRST_NAME' | translate }} <span class="required">*</span></label>
                <input type="text" [(ngModel)]="editingVisitor.firstName" [placeholder]="'PLACEHOLDER.ENTER_FIRST_NAME' | translate" />
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-user"></i> {{ 'VISITS.LAST_NAME' | translate }} <span class="required">*</span></label>
                <input type="text" [(ngModel)]="editingVisitor.lastName" [placeholder]="'PLACEHOLDER.ENTER_LAST_NAME' | translate" />
              </div>
              <div class="field">
                <label><i class="pi pi-phone"></i> {{ 'VISITS.PHONE' | translate }} <span class="required">*</span></label>
                <input type="text" [(ngModel)]="editingVisitor.phone" required #editPhone="ngModel" [placeholder]="'PLACEHOLDER.ENTER_PHONE' | translate" />
                @if (editPhone.invalid && editPhone.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-envelope"></i> {{ 'VISITS.EMAIL' | translate }}</label>
                <input type="email" [(ngModel)]="editingVisitor.email" [pattern]="emailPattern" #evEmail="ngModel" [placeholder]="'PLACEHOLDER.ENTER_EMAIL' | translate" />
                @if (evEmail.hasError('pattern') && evEmail.touched) {
                  <small class="field-error">{{ 'VALIDATION.EMAIL' | translate }}</small>
                }
              </div>
            </div>
            <div class="field checkbox-field vehicle-toggle">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="editingVisitor.hasVehicle" (ngModelChange)="onEditVehicleCheckboxChange()" />
                <i class="pi pi-car"></i>
                {{ 'VISITORS.HAS_VEHICLE' | translate }}
              </label>
            </div>
            @if (editingVisitor.hasVehicle) {
              <div class="vehicle-section" @slideSection>
                <div class="form-row">
                  <div class="field">
                    <label><i class="pi pi-car"></i> {{ 'VISITORS.CAR_NUMBER' | translate }} <span class="required">*</span></label>
                    <input type="text" [(ngModel)]="editingVisitor.carNumber" [placeholder]="'PLACEHOLDER.ENTER_CAR_NUMBER' | translate"
                      [class.input-invalid]="editingVisitor.hasVehicle && !editingVisitor.carNumber" />
                    @if (editingVisitor.hasVehicle && !editingVisitor.carNumber) {
                      <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                    }
                  </div>
                  <div class="field">
                    <label><i class="pi pi-car"></i> {{ 'VISITORS.VEHICLE_TYPE' | translate }} <span class="required">*</span></label>
                    <p-dropdown [options]="vehicleTypeOptions" [(ngModel)]="editingVisitor.vehicleType"
                      [group]="true" optionGroupLabel="label" optionGroupChildren="items"
                      optionLabel="label" optionValue="value"
                      [placeholder]="'VISITORS.SELECT_VEHICLE_TYPE' | translate"
                      [filter]="true" filterBy="label"
                      panelStyleClass="vehicle-type-panel"
                      [style]="{width: '100%'}" appendTo="body"
                      [class.input-invalid]="editingVisitor.hasVehicle && !editingVisitor.vehicleType"></p-dropdown>
                    @if (editingVisitor.hasVehicle && !editingVisitor.vehicleType) {
                      <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                    }
                  </div>
                </div>
              </div>
            }
            @if (canRequestParking) {
            <div class="field checkbox-field parking-toggle">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="editingVisitor.requestParking" />
                <i class="pi pi-warehouse"></i>
                {{ 'VISITORS.REQUEST_PARKING' | translate }}
              </label>
            </div>
            }
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showEditVisitorDialog = false" [disabled]="savingEditVisitor">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary save-btn" (click)="saveEditVisitor()" [disabled]="!isEditVisitorValid() || savingEditVisitor">
          @if (savingEditVisitor) {
            <i class="pi pi-spin pi-spinner"></i> {{ 'COMMON.SAVING' | translate }}
          } @else {
            <i class="pi pi-save"></i> {{ 'COMMON.SAVE' | translate }}
          }
        </button>
      </ng-template>
    </p-dialog>

    <!-- Edit Escort Dialog -->
    <p-dialog [header]="'VISITS.EDIT_ESCORT' | translate"
      [(visible)]="showEditEscortDialog" (onHide)="onEditEscortDialogHide()" [modal]="true" [style]="{width: '600px'}" [draggable]="false">
      @if (showEditEscortDialog && editingEscort) {
        <div class="dialog-form">
          <div class="inline-row">
            <div class="form-row">
              <div class="field">
                <label>{{ 'VISITS.FIRST_NAME' | translate }} <span class="required">*</span></label>
                <div class="input-wrapper">
                  <input type="text" [(ngModel)]="editingEscort.firstName"
                    (ngModelChange)="onEditEscortNameChange($event)"
                    (focus)="onEditEscortNameFocus('first')"
                    (blur)="onEditEscortNameBlur()"
                    [placeholder]="'PLACEHOLDER.ENTER_FIRST_NAME' | translate" autocomplete="off" />
                  @if (adEditEscortLoading) {
                    <i class="pi pi-spin pi-spinner input-spinner"></i>
                  }
                </div>
                @if (adEditEscortVisible && adEditEscortActiveField === 'first' && adEditEscortSuggestions.length) {
                  <div class="suggestions-panel">
                    @for (p of adEditEscortSuggestions; track $index) {
                      <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectEditEscortSuggestion(p)">
                        <div class="suggestion-main">
                          <span class="suggestion-name">{{ p.displayName || (p.firstName + ' ' + p.lastName) }}</span>
                        </div>
                        <div class="suggestion-secondary">
                          @if (p.email) { <span>{{ p.email }}</span> }
                          @if (p.phone) { <span>{{ p.phone }}</span> }
                        </div>
                      </div>
                    }
                  </div>
                } @else if (adEditEscortVisible && adEditEscortActiveField === 'first' && adEditEscortError) {
                  <div class="suggestions-panel">
                    <div class="suggestion-error"><i class="pi pi-exclamation-circle"></i> {{ adEditEscortError | translate }}</div>
                  </div>
                } @else if (adEditEscortVisible && adEditEscortActiveField === 'first' && adEditEscortNoResults) {
                  <div class="suggestions-panel">
                    <div class="suggestion-no-results">{{ 'AD_SEARCH.NO_RESULTS' | translate }}</div>
                  </div>
                }
              </div>
              <div class="field">
                <label>{{ 'VISITS.LAST_NAME' | translate }} <span class="required">*</span></label>
                <div class="input-wrapper">
                  <input type="text" [(ngModel)]="editingEscort.lastName"
                    (ngModelChange)="onEditEscortNameChange($event)"
                    (focus)="onEditEscortNameFocus('last')"
                    (blur)="onEditEscortNameBlur()"
                    [placeholder]="'PLACEHOLDER.ENTER_LAST_NAME' | translate" autocomplete="off" />
                  @if (adEditEscortLoading) {
                    <i class="pi pi-spin pi-spinner input-spinner"></i>
                  }
                </div>
                @if (adEditEscortVisible && adEditEscortActiveField === 'last' && adEditEscortSuggestions.length) {
                  <div class="suggestions-panel">
                    @for (p of adEditEscortSuggestions; track $index) {
                      <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectEditEscortSuggestion(p)">
                        <div class="suggestion-main">
                          <span class="suggestion-name">{{ p.displayName || (p.firstName + ' ' + p.lastName) }}</span>
                        </div>
                        <div class="suggestion-secondary">
                          @if (p.email) { <span>{{ p.email }}</span> }
                          @if (p.phone) { <span>{{ p.phone }}</span> }
                        </div>
                      </div>
                    }
                  </div>
                } @else if (adEditEscortVisible && adEditEscortActiveField === 'last' && adEditEscortError) {
                  <div class="suggestions-panel">
                    <div class="suggestion-error"><i class="pi pi-exclamation-circle"></i> {{ adEditEscortError | translate }}</div>
                  </div>
                } @else if (adEditEscortVisible && adEditEscortActiveField === 'last' && adEditEscortNoResults) {
                  <div class="suggestions-panel">
                    <div class="suggestion-no-results">{{ 'AD_SEARCH.NO_RESULTS' | translate }}</div>
                  </div>
                }
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label>{{ 'VISITS.PHONE' | translate }} <span class="required">*</span></label>
                <input type="text" [(ngModel)]="editingEscort.phone" [placeholder]="'PLACEHOLDER.ENTER_PHONE' | translate" />
              </div>
              <div class="field">
                <label>{{ 'VISITS.EMAIL' | translate }} <span class="required">*</span></label>
                <input type="email" [(ngModel)]="editingEscort.email" required [pattern]="emailPattern" #eeEmail="ngModel" [placeholder]="'PLACEHOLDER.ENTER_EMAIL' | translate" />
                @if (eeEmail.hasError('required') && eeEmail.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                } @else if (eeEmail.hasError('pattern') && eeEmail.touched) {
                  <small class="field-error">{{ 'VALIDATION.EMAIL' | translate }}</small>
                }
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label>{{ 'VISITS.SECTOR' | translate }}</label>
                <p-dropdown
                  [options]="escortSectorOptions"
                  [(ngModel)]="editingEscort.sector"
                  optionLabel="name"
                  optionValue="name"
                  [placeholder]="'VISITS.SECTOR' | translate"
                  appendTo="body"
                  [style]="{width: '100%'}"
                ></p-dropdown>
              </div>
            </div>
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="showEditEscortDialog = false" [disabled]="savingEditEscort">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary save-btn" (click)="saveEditEscort()" [disabled]="!isEditEscortValid() || savingEditEscort">
          @if (savingEditEscort) {
            <i class="pi pi-spin pi-spinner"></i> {{ 'COMMON.SAVING' | translate }}
          } @else {
            <i class="pi pi-save"></i> {{ 'COMMON.SAVE' | translate }}
          }
        </button>
      </ng-template>
    </p-dialog>

    <!-- History Dialog -->
    <app-visit-history-dialog
      [visible]="showHistoryDialog"
      [items]="historyItems"
      [loading]="loadingHistory"
      (visibleChange)="showHistoryDialog = $event"
    />
  `,
  styles: [`
    :host { display: block; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; }
    .header-left { display: flex; align-items: center; gap: 1rem; }
    .header-left h1 { margin: 0; }
    .header-actions { display: flex; gap: 0.5rem; }
    .btn-ghost {
      background: none; border: 1px solid var(--color-border, #e4e2f0);
      color: var(--color-text-secondary); cursor: pointer;
      font-size: 0.88rem; font-family: inherit;
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.4rem 0.75rem; border-radius: 8px;
      transition: all 0.2s;
    }
    .btn-ghost:hover { background: var(--color-primary-wash, #eeedf8); border-color: var(--color-accent-subtle, #ddd9ff); color: var(--color-primary, #020140); }

    /* ── Visit info card ── */
    .visit-info { margin-bottom: 1.25rem; }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.15rem;
      margin-bottom: 1.15rem;
    }
    .info-item { display: flex; flex-direction: column; gap: 0.3rem; }
    .info-item.full-width { grid-column: 1 / -1; }
    .info-label {
      font-size: 0.75rem; font-weight: 600; color: var(--color-text-muted, #9896ad);
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .info-value { font-size: 0.93rem; font-weight: 500; color: var(--color-text, #1a1a2e); }

    /* ── Summary bar ── */
    .summary-bar {
      display: flex; gap: 0.6rem; flex-wrap: wrap;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border, #e4e2f0);
    }
    .summary-item {
      display: inline-flex; align-items: center; gap: 0.35rem;
      font-size: 0.82rem; font-weight: 600;
      padding: 0.35rem 0.85rem; border-radius: 999px;
      border: 1px solid transparent;
      transition: background 0.2s ease, border-color 0.2s ease;
    }
    .summary-item i { font-size: 0.78rem; opacity: 0.85; }
    .summary-item.total { background: rgba(108, 99, 255, 0.08); color: #6c63ff; border-color: rgba(108, 99, 255, 0.15); }
    .summary-item.pending { background: rgba(245, 158, 11, 0.08); color: #b45309; border-color: rgba(245, 158, 11, 0.18); }
    .summary-item.arrived { background: rgba(59, 130, 246, 0.08); color: #1d4ed8; border-color: rgba(59, 130, 246, 0.18); }
    .summary-item.checked-in { background: rgba(34, 197, 94, 0.08); color: #15803d; border-color: rgba(34, 197, 94, 0.18); }
    .summary-item.checked-out { background: rgba(100, 116, 139, 0.08); color: #475569; border-color: rgba(100, 116, 139, 0.18); }

    /* ── Section titles ── */
    .section-title {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 1.05rem; font-weight: 700;
      margin: 0 0 1rem 0;
      color: var(--color-primary, #020140);
      letter-spacing: -0.01em;
    }
    .section-title i { color: var(--color-accent, #6c63ff); font-size: 1.05rem; }

    /* ── Data tables ── */
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
    .name-cell { font-weight: 500; }
    .actions { display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; }

    /* ── Action buttons ── */
    .btn-sm {
      font-size: 0.78rem; padding: 0.38rem 0.8rem;
      border-radius: 8px; border: 1px solid transparent; cursor: pointer;
      font-weight: 600; font-family: inherit;
      display: inline-flex; align-items: center; gap: 0.35rem;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .btn-sm:focus-visible { outline: 2px solid var(--color-accent, #6c63ff); outline-offset: 2px; }
    .btn-sm:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
    .btn-sm i { font-size: 0.78rem; }
    .btn-arrived { background: rgba(59, 130, 246, 0.10); color: #1d4ed8; border-color: rgba(59, 130, 246, 0.20); }
    .btn-arrived:hover { background: rgba(59, 130, 246, 0.20); border-color: rgba(59, 130, 246, 0.35); box-shadow: 0 1px 4px rgba(59, 130, 246, 0.15); }
    .btn-check-in { background: rgba(34, 197, 94, 0.10); color: #15803d; border-color: rgba(34, 197, 94, 0.20); }
    .btn-check-in:hover { background: rgba(34, 197, 94, 0.20); border-color: rgba(34, 197, 94, 0.35); box-shadow: 0 1px 4px rgba(34, 197, 94, 0.15); }
    .btn-check-out { background: rgba(100, 116, 139, 0.10); color: #475569; border-color: rgba(100, 116, 139, 0.20); }
    .btn-check-out:hover { background: rgba(100, 116, 139, 0.20); border-color: rgba(100, 116, 139, 0.35); box-shadow: 0 1px 4px rgba(100, 116, 139, 0.15); }

    /* ── Status badges ── */
    .status-badge {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.3rem 0.75rem; border-radius: 999px;
      font-size: 0.78rem; font-weight: 600;
      white-space: nowrap; line-height: 1.4;
      border: 1px solid transparent;
    }
    .status-badge::before {
      content: ''; display: inline-block;
      width: 7px; height: 7px; border-radius: 50%;
      background: currentColor; opacity: 0.7;
      flex-shrink: 0;
    }
    .status-badge.status-pending { background: rgba(245, 158, 11, 0.10); color: #b45309; border-color: rgba(245, 158, 11, 0.20); }
    .status-badge.status-arrived { background: rgba(59, 130, 246, 0.10); color: #1d4ed8; border-color: rgba(59, 130, 246, 0.20); }
    .status-badge.status-checked-in { background: rgba(34, 197, 94, 0.10); color: #15803d; border-color: rgba(34, 197, 94, 0.20); }
    .status-badge.status-checked-out { background: rgba(100, 116, 139, 0.10); color: #475569; border-color: rgba(100, 116, 139, 0.20); }

    /* ── Loading & empty ── */
    .loading-msg, .empty-msg { text-align: center; padding: 2.5rem; color: var(--color-text-muted); font-size: 0.9rem; }

    /* ── Dialog forms ── */
      .dialog-form { display: flex; flex-direction: column; gap: 1rem; max-height: 70vh; overflow-y: auto; }
      .dialog-form .field { display: flex; flex-direction: column; gap: 0.3rem; }
      .dialog-form .field label { font-weight: 500; font-size: 0.85rem; color: var(--color-text-secondary); }
      .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
      @media (max-width: 600px) {
        .form-row { grid-template-columns: 1fr; }
      }

      /* ── Label icons ── */
      .field label i { font-size: 0.82rem; color: var(--color-accent, #6c63ff); margin-inline-end: 0.2rem; }

      /* ── Checkbox fields ── */
      .checkbox-field { margin-bottom: 0.25rem; }
      .checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; color: var(--color-text-primary); }
      .checkbox-label input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-primary); }

      /* ── Vehicle & requester toggle + slide animation ── */
      .vehicle-toggle .checkbox-label { gap: 0.45rem; }
      .vehicle-toggle .checkbox-label i.pi-car { font-size: 0.95rem; color: var(--color-accent, #6c63ff); transition: color 0.2s; }
      .parking-toggle { padding-top: 0.5rem; }
      .parking-toggle .checkbox-label i.pi-warehouse { font-size: 0.95rem; color: var(--color-accent, #6c63ff); transition: color 0.2s; }
      .vehicle-section {
        margin-top: 0.25rem;
      }
    /* ── Inline rows ── */
    .inline-row {
      background: var(--color-surface-alt, #f8f8fc);
      border: 1px solid var(--color-border, #e4e2f0);
      border-radius: 10px; padding: 0.85rem 1rem;
      display: flex; flex-direction: column; gap: 0.6rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .inline-row:hover {
      border-color: var(--color-accent-subtle, #ddd9ff);
      box-shadow: 0 2px 8px rgba(108, 99, 255, 0.06);
    }
    .inline-row-header { display: flex; justify-content: space-between; align-items: center; }
    .inline-row-num { font-weight: 700; font-size: 0.8rem; color: var(--color-accent, #6c63ff); }
      .btn-add-inline { align-self: flex-start; }
      .visitor-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .import-errors {
      background: #fff1f2; border: 1px solid #fecdd3;
      border-radius: 8px; padding: 0.75rem 0.85rem;
      margin-top: 0.5rem; font-size: 0.82rem; width: 100%;
    }
    .import-errors-header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; color: #dc2626; margin-bottom: 0.4rem; }
    .import-errors-header span { display: flex; align-items: center; gap: 0.3rem; }
    .import-error-row { color: #7f1d1d; padding: 0.15rem 0; }
    .required { color: #dc2626; }
    .input-invalid { border-color: #dc2626 !important; }
    ::ng-deep .input-invalid .p-dropdown,
    ::ng-deep p-dropdown.ng-invalid.ng-touched .p-dropdown { border-color: #dc2626 !important; }

    /* ── Autocomplete ── */
    .input-wrapper { position: relative; display: flex; align-items: center; }
    .input-wrapper input { width: 100%; padding-inline-end: 2rem; }
    .input-spinner { position: absolute; inset-inline-end: 0.6rem; font-size: 0.85rem; color: var(--color-accent, #6c63ff); pointer-events: none; }
    .field-warning { display: flex; align-items: center; gap: 0.3rem; color: #d97706; font-size: 0.8rem; font-weight: 500; }
    .field-warning i { font-size: 0.78rem; }
    .field { position: relative; }
    .suggestions-panel {
      position: absolute; z-index: 10; top: 100%; left: 0; right: 0;
      max-height: 220px; overflow-y: auto;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e4e2f0);
      border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin-top: 4px;
    }
    .suggestion-item {
      padding: 0.6rem 0.85rem; cursor: pointer;
      border-bottom: 1px solid var(--color-border-light, #f0eef6);
      transition: background 0.15s;
    }
    .suggestion-item:last-child { border-bottom: none; }
    .suggestion-item:hover { background: var(--color-primary-wash, #eeedf8); }
    .suggestion-main { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .suggestion-name { font-weight: 600; font-size: 0.85rem; color: var(--color-text, #1e1e2f); }
    .suggestion-pid { font-size: 0.82rem; color: var(--color-accent, #6c63ff); font-weight: 500; font-family: monospace; }
    .suggestion-secondary { display: flex; gap: 0.75rem; font-size: 0.78rem; color: var(--color-text-muted, #9795a5); margin-top: 0.2rem; }
    .suggestion-no-results { padding: 0.85rem; text-align: center; font-size: 0.82rem; color: var(--color-text-muted, #9795a5); }
    .suggestion-error { padding: 0.85rem; text-align: center; font-size: 0.82rem; color: #dc2626; display: flex; align-items: center; justify-content: center; gap: 0.4rem; }
    .suggestion-error i { font-size: 0.85rem; }

    /* ── History ── */
    .history-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .history-item {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.65rem 0.85rem; border-radius: 8px;
      background: var(--color-surface-alt, #f8f8fc);
      border: 1px solid var(--color-border-light, #eeedfa);
      transition: border-color 0.15s;
    }
    .history-item:hover { border-color: var(--color-border, #e4e2f0); }
    .history-event {
      font-weight: 600; font-size: 0.82rem;
      padding: 0.28rem 0.65rem; border-radius: 8px;
      white-space: nowrap;
      display: inline-flex; align-items: center; gap: 0.3rem;
      border: 1px solid transparent;
    }
    .history-event::before {
      content: ''; display: inline-block;
      width: 6px; height: 6px; border-radius: 50%;
      background: currentColor; opacity: 0.65;
      flex-shrink: 0;
    }
    .history-event.event-arrived { background: rgba(59, 130, 246, 0.10); color: #1d4ed8; border-color: rgba(59, 130, 246, 0.18); }
    .history-event.event-checked-in { background: rgba(34, 197, 94, 0.10); color: #15803d; border-color: rgba(34, 197, 94, 0.18); }
    .history-event.event-checked-out { background: rgba(100, 116, 139, 0.10); color: #475569; border-color: rgba(100, 116, 139, 0.18); }
    .history-time { font-size: 0.82rem; color: var(--color-text-secondary); }
    .history-source { font-size: 0.78rem; color: var(--color-text-muted); font-style: italic; }
    .history-notes { font-size: 0.78rem; color: var(--color-text-muted); }

    /* ── Save button ── */
    .save-btn { min-width: 110px; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
    .save-btn .pi-spinner { font-size: 0.85rem; }

    .card { margin-bottom: 1.25rem; }
    :host ::ng-deep .p-dropdown { width: 100%; }
    ::ng-deep .vehicle-type-panel .p-dropdown-header {
      padding: 0.5rem;
      overflow: hidden;
      box-sizing: border-box;
    }
    ::ng-deep .vehicle-type-panel .p-dropdown-filter-container {
      width: 100%;
      max-width: 100%;
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      align-items: center;
    }
    ::ng-deep .vehicle-type-panel .p-dropdown-filter {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      margin: 0 !important;
      display: block;
      height: 2.5rem;
      direction: ltr;
      text-align: left;
      padding-right: 0.75rem;
      padding-left: 2rem;
      font-size: 0.9rem;
      border: 1px solid var(--color-border, #e4e2f0);
      border-radius: 8px;
      outline: none;
    }
    ::ng-deep .vehicle-type-panel .p-dropdown-filter:focus {
      border-color: var(--color-accent, #6c63ff);
      box-shadow: 0 0 0 2px rgba(108,99,255,0.12);
    }
    ::ng-deep .vehicle-type-panel .p-dropdown-filter-icon {
      position: absolute !important;
      left: 0.75rem !important;
      right: auto !important;
      inset-inline-start: 0.75rem !important;
      inset-inline-end: auto !important;
      top: 0 !important;
      bottom: 0 !important;
      margin: auto !important;
      transform: none !important;
      height: fit-content;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      line-height: 1;
    }
    ::ng-deep .vehicle-type-panel .p-dropdown-item-group {
      font-weight: 700;
      font-size: 0.85rem;
      color: var(--color-accent, #6c63ff);
      padding: 0.6rem 0.85rem 0.3rem;
      background: var(--color-surface, #fff);
      position: sticky;
      top: 0;
    }
    ::ng-deep .vehicle-type-panel .p-dropdown-items .p-dropdown-item {
      text-align: right;
      padding-inline-end: 1.5rem;
    }

    /* ── Files section ── */
    .files-section { margin-top: 1.25rem; }
    .files-section .section-header {
      display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;
    }
    .files-section .section-header h2 {
      margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--color-primary, #020140);
      display: flex; align-items: center; gap: 0.5rem; flex: 1;
    }
    .files-section .section-header h2 i { color: var(--color-accent, #6c63ff); }
    .files-section .empty-state { color: var(--color-text-muted, #9896ad); font-size: 0.88rem; padding: 1rem 0; }
    .files-section .loading-row { padding: 1rem 0; text-align: center; color: var(--color-text-muted); }
    .files-section .file-list { display: flex; flex-direction: column; gap: 0.4rem; }
    .files-section .file-item {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 0.55rem 0.75rem; border-radius: 8px;
      background: var(--color-surface-alt, #f8f7fc);
      font-size: 0.88rem; transition: background 0.15s;
    }
    .files-section .file-item:hover { background: rgba(108, 99, 255, 0.05); }
    .files-section .file-item .pi-file { color: var(--color-accent, #6c63ff); }
    .files-section .file-item .file-name { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .files-section .file-item .file-size { color: var(--color-text-muted, #9896ad); font-size: 0.75rem; white-space: nowrap; }
    .files-section .file-item .file-date { color: var(--color-text-muted, #9896ad); font-size: 0.75rem; white-space: nowrap; }
    .btn-sm { font-size: 0.82rem; padding: 0.35rem 0.7rem; }
  `],
})
export class VisitDetailComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private excelImport = inject(ExcelImportService);
  private translateService = inject(TranslateService);
  private blacklistCheck = inject(BlacklistCheckService);
  private visitorSearch = inject(VisitorSearchService);
  private adSearch = inject(AdSearchService);
  private sectorsLookup = inject(SectorsLookupService);
  private visitsApi = inject(VisitsApiService);
  private printService = inject(VisitorPrintService);
  private confirmService = inject(ConfirmService);
  private deviceStatus = inject(DeviceStatusService);
  private workstationSession = inject(WorkstationSessionService);
  private permissionService = inject(PermissionService);

  canRequestParking = false;

  visitId = '';
  visit: Visit | null = null;
  visitors: VisitVisitor[] = [];
  escorts: VisitEscort[] = [];
  loadingVisitors = false;
  loadingEscorts = false;
  codeMap = new Map<string, string>();

  // Status constants for template
  statusPending = VisitorStatus.Pending;
  statusArrived = VisitorStatus.Arrived;
  statusCheckedIn = VisitorStatus.CheckedIn;
  statusCheckedOut = VisitorStatus.CheckedOut;
  emailPattern = EMAIL_PATTERN.source;

  // Event constants for template
  eventArrived = VisitorAccessEventType.Arrived;
  eventCheckedIn = VisitorAccessEventType.CheckedIn;
  eventCheckedOut = VisitorAccessEventType.CheckedOut;

  vehicleTypeOptions: { label: string; items: { label: string; value: string }[] }[] = [];
  escortSectorOptions: SectorLookupItem[] = [];

  // Add visitor dialog
  showAddVisitorDialog = false;
  newVisitors: InlineVisitor[] = [];
  savingVisitor = false;
  importErrors: string[] = [];
  blacklistMap = new Map<number, { checking: boolean; blacklisted: boolean; reason?: string }>();
  private blacklistSubjects = new Map<number, Subject<string>>();
  private blacklistSubs: Subscription[] = [];
  editBlacklistStatus: { checking: boolean; blacklisted: boolean; reason?: string } | null = null;
  private editBlacklistSubject = new Subject<string>();
  private editBlacklistSub: Subscription | null = null;
  visitorSuggestions = new Map<number, VisitorSuggestion[]>();
  showNoResults = new Map<number, boolean>();
  searchLoading = new Map<number, boolean>();
  suggestionsVisible = new Map<number, boolean>();
  private searchSubjects = new Map<number, Subject<string>>();
  private searchSubs: Subscription[] = [];
  editVisitorSuggestions: VisitorSuggestion[] = [];
  editShowNoResults = false;
  editSearchLoading = false;
  editSuggestionsVisible = false;
  private editSearchSubject = new Subject<string>();
  private editSearchSub: Subscription | null = null;

  // Add escort dialog
  showAddEscortDialog = false;
  newEscorts: InlineEscort[] = [];
  savingEscort = false;

  // Edit visitor dialog
  showEditVisitorDialog = false;
  editingVisitorVvId = '';
  editingVisitor: InlineVisitor | null = null;
  savingEditVisitor = false;

  // Edit escort dialog
  showEditEscortDialog = false;
  editingEscortId = '';
  editingEscort: InlineEscort | null = null;
  savingEditEscort = false;

  // AD person search state — add escort dialog
  adEscortSuggestions = new Map<number, AdPersonSuggestion[]>();
  adEscortLoading = new Map<number, boolean>();
  adEscortVisible = new Map<number, boolean>();
  adEscortNoResults = new Map<number, boolean>();
  adEscortError = new Map<number, string>();
  adEscortActiveField = new Map<number, 'first' | 'last' | ''>();
  private adEscortSubjects = new Map<number, Subject<string>>();
  private adEscortSubs: Subscription[] = [];

  // AD person search state — edit escort dialog
  adEditEscortSuggestions: AdPersonSuggestion[] = [];
  adEditEscortLoading = false;
  adEditEscortVisible = false;
  adEditEscortNoResults = false;
  adEditEscortError = '';
  adEditEscortActiveField: 'first' | 'last' | '' = '';
  private adEditEscortSubject = new Subject<string>();
  private adEditEscortSub?: Subscription;

  // History dialog
  showHistoryDialog = false;
  historyItems: VisitorAccessLogEntry[] = [];
  loadingHistory = false;

  // Files
  visitFiles: import('../services/visits-api.service').VisitFileItem[] = [];
  loadingFiles = false;

  // Printing
  printingVisitorId: string | null = null;
  isPrinterConnected = false;
  private printSub: Subscription | null = null;
  private deviceSub: Subscription | null = null;

  private readonly vehicleModelsApi = inject(VehicleModelsApiService);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.vehicleModelsApi.lookup().subscribe({
      next: (options) => this.vehicleTypeOptions = options,
      error: () => this.vehicleTypeOptions = [],
    });
    this.canRequestParking = this.permissionService.hasPermission('parking.request');
    this.visitId = this.route.snapshot.paramMap.get('visitId') ?? '';
    this.loadEscortSectorOptions();
    this.loadVisit();
    this.loadVisitors();
    this.loadEscorts();
    this.loadFiles();
    this.initPrintListeners();
  }

  goBack(): void {
    this.router.navigate(['/visits']);
  }

  private denyAction(): void {
    this.notify.error('COMMON.ACTION_NOT_ALLOWED');
  }

  private ensurePermission(permission: string): boolean {
    if (this.permissionService.hasPermission(permission)) {
      return true;
    }
    this.denyAction();
    return false;
  }

  loadVisit(): void {
    this.visitsApi.getVisit(this.visitId).subscribe({
      next: (v) => { this.visit = v; },
      error: () => { this.notify.error('COMMON.ERROR'); },
    });
  }

  loadVisitors(): void {
    this.loadingVisitors = true;
    this.visitsApi.getVisitors(this.visitId).subscribe({
      next: (vvs) => { this.visitors = vvs; this.loadingVisitors = false; this.loadCheckInCodes(); },
      error: () => { this.loadingVisitors = false; },
    });
  }

  loadCheckInCodes(): void {
    this.visitsApi.getCheckInCodes(this.visitId).subscribe({
      next: (codes) => {
        this.codeMap.clear();
        for (const c of codes) {
          if (c.isActive && !c.usedAtUtc) {
            this.codeMap.set(c.visitVisitorId, c.code);
          }
        }
      },
    });
  }

  loadEscorts(): void {
    this.loadingEscorts = true;
    this.visitsApi.getEscorts(this.visitId).subscribe({
      next: (es) => { this.escorts = es; this.loadingEscorts = false; },
      error: () => { this.loadingEscorts = false; },
    });
  }

  private loadEscortSectorOptions(): void {
    this.sectorsLookup.getActiveSectors().subscribe({
      next: (items) => { this.escortSectorOptions = items; },
      error: () => { this.escortSectorOptions = []; },
    });
  }

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

  getEventClass(eventType: number): string {
    switch (eventType) {
      case VisitorAccessEventType.Arrived: return 'event-arrived';
      case VisitorAccessEventType.CheckedIn: return 'event-checked-in';
      case VisitorAccessEventType.CheckedOut: return 'event-checked-out';
      default: return '';
    }
  }

  getEventLabel(eventType: number): string {
    switch (eventType) {
      case VisitorAccessEventType.Arrived: return 'VISITS.STATUS_ARRIVED';
      case VisitorAccessEventType.CheckedIn: return 'VISITS.STATUS_CHECKED_IN';
      case VisitorAccessEventType.CheckedOut: return 'VISITS.STATUS_CHECKED_OUT';
      default: return '';
    }
  }

  registerEvent(vv: VisitVisitor, eventType: VisitorAccessEventType): void {
    if (!this.ensurePermission('visits.update')) return;
    this.api.post<any>('/visitor-access-logs', {
      visitVisitorId: vv.id,
      eventType,
    }).subscribe({
      next: (res) => {
        this.notify.success('COMMON.SUCCESS');
        if (res?.amadeusSync && !res.amadeusSync.success) {
          this.notify.warn('VISITS.AMADEUS_SYNC_FAILED');
        }
        this.loadVisit();
        this.loadVisitors();
      },
      error: (err) => this.notify.error(err),
    });
  }

  openHistoryDialog(vv: VisitVisitor): void {
    this.showHistoryDialog = true;
    this.loadingHistory = true;
    this.historyItems = [];
    this.api.get<VisitorAccessLogEntry[]>(`/visit-visitors/${vv.id}/history`).subscribe({
      next: (items) => { this.historyItems = items; this.loadingHistory = false; },
      error: () => { this.loadingHistory = false; },
    });
  }

  async removeVisitor(vv: VisitVisitor): Promise<void> {
    if (!this.ensurePermission('visits.delete')) return;
    if (!await this.confirmService.confirm('COMMON.CONFIRM_REMOVE')) return;
    this.visitsApi.removeVisitor(this.visitId, vv.id).subscribe({
      next: () => { this.notify.success('COMMON.SUCCESS'); this.loadVisit(); this.loadVisitors(); },
      error: (err) => this.notify.error(err),
    });
  }

  async removeEscort(escort: VisitEscort): Promise<void> {
    if (!this.ensurePermission('visits.delete')) return;
    if (!await this.confirmService.confirm('COMMON.CONFIRM_REMOVE')) return;
    this.visitsApi.removeEscort(this.visitId, escort.id).subscribe({
      next: () => { this.notify.success('COMMON.SUCCESS'); this.loadEscorts(); },
      error: (err) => this.notify.error(err),
    });
  }

  // -- Add Visitor Dialog --

  openAddVisitorDialog(): void {
    if (!this.ensurePermission('visits.create')) return;
    this.newVisitors = [];
    this.importErrors = [];
    this.clearBlacklistState();
    this.addNewVisitorRow();
    this.showAddVisitorDialog = true;
  }

  addNewVisitorRow(): void {
    this.newVisitors.push({ firstName: '', lastName: '', email: '', phone: '', personId: '', hasVehicle: false, carNumber: '', vehicleType: '', requestParking: false });
  }

  removeNewVisitor(index: number): void {
    this.newVisitors.splice(index, 1);
    this.blacklistMap.delete(index);
    this.visitorSuggestions.delete(index);
    this.showNoResults.delete(index);
    this.searchLoading.delete(index);
    this.suggestionsVisible.delete(index);
    const newMap = new Map<number, { checking: boolean; blacklisted: boolean; reason?: string }>();
    for (const [k, v] of this.blacklistMap) {
      newMap.set(k > index ? k - 1 : k, v);
    }
    this.blacklistMap = newMap;
    const newSuggestions = new Map<number, VisitorSuggestion[]>();
    for (const [k, v] of this.visitorSuggestions) {
      newSuggestions.set(k > index ? k - 1 : k, v);
    }
    this.visitorSuggestions = newSuggestions;
  }

  async onVisitorFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.importErrors = [];

    try {
      const rows = await this.excelImport.parseFile(file);
      if (!rows.length) {
        this.notify.error('VISITS.IMPORT_EMPTY_FILE');
        return;
      }

      const mapped = this.excelImport.mapRows(rows);
      const result = this.excelImport.validateVisitorRows(mapped);

      if (result.invalid.length && !result.valid.length) {
        this.notify.error(this.translateService.instant('VISITS.IMPORT_ALL_INVALID', { count: result.invalid.length }));
        this.importErrors = result.invalid.map(e =>
          this.translateService.instant('VISITS.IMPORT_ROW_ERROR', { row: e.row, fields: e.errors.join(', ') })
        );
        return;
      }

      for (const row of result.valid) {
        this.newVisitors.push({
          firstName: row['firstName'] ?? '',
          lastName: row['lastName'] ?? '',
          email: row['email'] ?? '',
          phone: row['phone'] ?? '',
          personId: row['personId'] ?? '',
          hasVehicle: !!(row['carNumber']),
          carNumber: row['carNumber'] ?? '',
          vehicleType: row['vehicleType'] ?? '',
          requestParking: false,
        });
      }

      if (result.invalid.length) {
        this.notify.success(this.translateService.instant('VISITS.IMPORT_PARTIAL', { valid: result.valid.length, invalid: result.invalid.length }));
        this.importErrors = result.invalid.map(e =>
          this.translateService.instant('VISITS.IMPORT_ROW_ERROR', { row: e.row, fields: e.errors.join(', ') })
        );
      } else {
        this.notify.success(this.translateService.instant('VISITS.IMPORT_SUCCESS', { count: result.valid.length }));
      }
    } catch {
      this.notify.error('VISITS.IMPORT_INVALID_FILE');
    }
  }

  isAddVisitorsValid(): boolean {
    if (!this.newVisitors.length) return false;
    return this.newVisitors.every(v => !!v.firstName && !!v.lastName && !!v.personId && (!v.hasVehicle || (!!v.carNumber && !!v.vehicleType)));
  }

  addVisitors(): void {
    if (!this.ensurePermission('visits.create')) return;
    if (!this.isAddVisitorsValid()) return;
    this.savingVisitor = true;
    const body = {
      visitors: this.newVisitors.map(v => ({
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email || undefined,
        phone: v.phone || undefined,
        personId: v.personId || undefined,
        hasVehicle: v.hasVehicle,
        carNumber: v.hasVehicle ? (v.carNumber || undefined) : undefined,
        vehicleType: v.hasVehicle ? (v.vehicleType || undefined) : undefined,
        requestParking: v.hasVehicle ? v.requestParking : undefined,
      })),
    };
    this.visitsApi.addVisitors(this.visitId, body).subscribe({
      next: () => {
        this.savingVisitor = false;
        this.showAddVisitorDialog = false;
        this.newVisitors = [];
        this.notify.success('COMMON.SUCCESS');
        this.loadVisit();
        this.loadVisitors();
      },
      error: (err) => { this.savingVisitor = false; this.notify.error(err); },
    });
  }

  // -- Add Escort Dialog --

  openAddEscortDialog(): void {
    if (!this.ensurePermission('visits.create')) return;
    this.newEscorts = [];
    this.addNewEscortRow();
    this.showAddEscortDialog = true;
  }

  addNewEscortRow(): void {
    this.newEscorts.push({ firstName: '', lastName: '', phone: '', email: '', sector: '' });
  }

  removeNewEscort(index: number): void {
    this.newEscorts.splice(index, 1);
  }

  isAddEscortsValid(): boolean {
    if (!this.newEscorts.length) return false;
    return this.newEscorts.every(e => !!e.firstName && !!e.lastName && !!e.phone && !!e.email);
  }

  addEscorts(): void {
    if (!this.ensurePermission('visits.create')) return;
    if (!this.isAddEscortsValid()) return;
    this.savingEscort = true;
    const body = {
      escorts: this.newEscorts.map(e => ({
        firstName: e.firstName,
        lastName: e.lastName,
        phone: e.phone,
        email: e.email,
        sector: e.sector || undefined,
      })),
    };
    this.visitsApi.addEscorts(this.visitId, body).subscribe({
      next: () => {
        this.savingEscort = false;
        this.showAddEscortDialog = false;
        this.newEscorts = [];
        this.notify.success('COMMON.SUCCESS');
        this.loadEscorts();
      },
      error: (err) => { this.savingEscort = false; this.notify.error(err); },
    });
  }

  // -- Edit Visitor Dialog --

  openEditVisitorDialog(vv: VisitVisitor): void {
    if (!this.ensurePermission('visits.update')) return;
    this.editingVisitorVvId = vv.id;
    this.editingVisitor = {
      firstName: vv.visitor?.firstName ?? '',
      lastName: vv.visitor?.lastName ?? '',
      email: vv.visitor?.email ?? '',
      phone: vv.visitor?.phone ?? '',
      personId: vv.visitor?.personId ?? '',
      hasVehicle: !!(vv.visitor?.carNumber),
      carNumber: vv.visitor?.carNumber ?? '',
      vehicleType: vv.visitor?.vehicleType ?? '',
      requestParking: !!vv.parkingRequest,
    };
    this.editBlacklistStatus = null;
    this.editBlacklistSub?.unsubscribe();
    this.editBlacklistSub = null;
    this.showEditVisitorDialog = true;
  }

  isEditVisitorValid(): boolean {
    if (!this.editingVisitor) return false;
    if (!this.editingVisitor.firstName || !this.editingVisitor.lastName || !this.editingVisitor.personId) return false;
    if (this.editingVisitor.hasVehicle && (!this.editingVisitor.carNumber || !this.editingVisitor.vehicleType)) return false;
    return true;
  }

  onNewVehicleCheckboxChange(v: InlineVisitor): void {
    if (!v.hasVehicle) {
      v.carNumber = '';
      v.vehicleType = '';
      v.requestParking = false;
    }
  }

  onEditVehicleCheckboxChange(): void {
    if (this.editingVisitor && !this.editingVisitor.hasVehicle) {
      this.editingVisitor.carNumber = '';
      this.editingVisitor.vehicleType = '';
      this.editingVisitor.requestParking = false;
    }
  }

  saveEditVisitor(): void {
    if (!this.ensurePermission('visits.update')) return;
    if (!this.isEditVisitorValid() || !this.editingVisitor) return;
    this.savingEditVisitor = true;
    const v = this.editingVisitor;
    const body = {
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email || undefined,
      phone: v.phone || undefined,
      personId: v.personId,
      hasVehicle: v.hasVehicle,
      carNumber: v.hasVehicle ? (v.carNumber || undefined) : undefined,
      vehicleType: v.hasVehicle ? (v.vehicleType || undefined) : undefined,
      requestParking: v.hasVehicle ? v.requestParking : undefined,
    };
    this.visitsApi.updateVisitor(this.visitId, this.editingVisitorVvId, body).subscribe({
      next: () => {
        this.savingEditVisitor = false;
        this.showEditVisitorDialog = false;
        this.editingVisitor = null;
        this.notify.success('COMMON.SUCCESS');
        this.loadVisitors();
      },
      error: (err) => { this.savingEditVisitor = false; this.notify.error(err); },
    });
  }

  // -- Edit Escort Dialog --

  openEditEscortDialog(escort: VisitEscort): void {
    if (!this.ensurePermission('visits.update')) return;
    this.editingEscortId = escort.id;
    this.editingEscort = {
      firstName: escort.firstName,
      lastName: escort.lastName,
      phone: escort.phone,
      email: escort.email,
      sector: escort.sector ?? '',
    };
    this.showEditEscortDialog = true;
  }

  isEditEscortValid(): boolean {
    if (!this.editingEscort) return false;
    return !!this.editingEscort.firstName && !!this.editingEscort.lastName && !!this.editingEscort.phone && !!this.editingEscort.email;
  }

  saveEditEscort(): void {
    if (!this.ensurePermission('visits.update')) return;
    if (!this.isEditEscortValid() || !this.editingEscort) return;
    this.savingEditEscort = true;
    const e = this.editingEscort;
    const body = {
      firstName: e.firstName,
      lastName: e.lastName,
      phone: e.phone,
      email: e.email,
      sector: e.sector || undefined,
    };
    this.visitsApi.updateEscort(this.visitId, this.editingEscortId, body).subscribe({
      next: () => {
        this.savingEditEscort = false;
        this.showEditEscortDialog = false;
        this.editingEscort = null;
        this.notify.success('COMMON.SUCCESS');
        this.loadEscorts();
      },
      error: (err) => { this.savingEditEscort = false; this.notify.error(err); },
    });
  }

  // ── Blacklist & visitor search ──

  onNewVisitorPersonIdChange(index: number, value: string): void {
    if (!value || !value.trim()) {
      this.blacklistMap.delete(index);
      this.visitorSuggestions.delete(index);
      this.showNoResults.delete(index);
      this.searchLoading.delete(index);
      return;
    }
    // Skip search/blacklist if input contains non-digit characters
    if (!/^\d+$/.test(value.trim())) {
      this.visitorSuggestions.delete(index);
      this.showNoResults.delete(index);
      this.searchLoading.delete(index);
      return;
    }
    // Blacklist check
    let subj = this.blacklistSubjects.get(index);
    if (!subj) {
      subj = new Subject<string>();
      this.blacklistSubjects.set(index, subj);
      const sub = subj.pipe(
        debounceTime(500),
        switchMap(id => {
          this.blacklistMap.set(index, { checking: true, blacklisted: false });
          return this.blacklistCheck.check(id);
        }),
      ).subscribe(result => {
        this.blacklistMap.set(index, { checking: false, blacklisted: result.isBlacklisted, reason: result.reason });
      });
      this.blacklistSubs.push(sub);
    }
    subj.next(value.trim());

    // Visitor search
    let searchSubj = this.searchSubjects.get(index);
    if (!searchSubj) {
      searchSubj = new Subject<string>();
      this.searchSubjects.set(index, searchSubj);
      const sub = searchSubj.pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(prefix => {
          if (prefix.length < 3) {
            this.visitorSuggestions.delete(index);
            this.showNoResults.delete(index);
            this.searchLoading.delete(index);
            return [];
          }
          this.searchLoading.set(index, true);
          return this.visitorSearch.searchByPersonId(prefix);
        }),
      ).subscribe(results => {
        this.searchLoading.delete(index);
        if (results.length) {
          this.visitorSuggestions.set(index, results);
          this.showNoResults.delete(index);
        } else {
          this.visitorSuggestions.delete(index);
          this.showNoResults.set(index, true);
        }
        this.suggestionsVisible.set(index, true);
      });
      this.searchSubs.push(sub);
    }
    searchSubj.next(value.trim());
  }

  onNewPersonIdFocus(index: number): void {
    if (this.visitorSuggestions.has(index) || this.showNoResults.has(index)) {
      this.suggestionsVisible.set(index, true);
    }
  }

  onNewPersonIdBlur(index: number): void {
    setTimeout(() => this.suggestionsVisible.delete(index), 200);
  }

  selectNewVisitorSuggestion(index: number, visitor: VisitorSuggestion): void {
    const v = this.newVisitors[index];
    if (!v) return;
    v.firstName = visitor.firstName;
    v.lastName = visitor.lastName;
    v.personId = visitor.personId;
    v.phone = visitor.phone ?? '';
    v.email = visitor.email ?? '';
    v.carNumber = visitor.carNumber ?? '';
    v.vehicleType = visitor.vehicleType ?? '';
    v.hasVehicle = !!(visitor.carNumber);
    this.visitorSuggestions.delete(index);
    this.showNoResults.delete(index);
    this.suggestionsVisible.delete(index);
    const blSubj = this.blacklistSubjects.get(index);
    if (blSubj) blSubj.next(visitor.personId);
  }

  onEditVisitorPersonIdChange(value: string): void {
    if (!value || !value.trim()) {
      this.editBlacklistStatus = null;
      this.editVisitorSuggestions = [];
      this.editShowNoResults = false;
      this.editSearchLoading = false;
      return;
    }
    // Skip search/blacklist if input contains non-digit characters
    if (!/^\d+$/.test(value.trim())) {
      this.editVisitorSuggestions = [];
      this.editShowNoResults = false;
      this.editSearchLoading = false;
      return;
    }
    // Blacklist check
    if (!this.editBlacklistSub) {
      this.editBlacklistSub = this.editBlacklistSubject.pipe(
        debounceTime(500),
        switchMap(id => {
          this.editBlacklistStatus = { checking: true, blacklisted: false };
          return this.blacklistCheck.check(id);
        }),
      ).subscribe(result => {
        this.editBlacklistStatus = { checking: false, blacklisted: result.isBlacklisted, reason: result.reason };
      });
    }
    this.editBlacklistSubject.next(value.trim());

    // Visitor search
    if (!this.editSearchSub) {
      this.editSearchSub = this.editSearchSubject.pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(prefix => {
          if (prefix.length < 3) {
            this.editVisitorSuggestions = [];
            this.editShowNoResults = false;
            this.editSearchLoading = false;
            return [];
          }
          this.editSearchLoading = true;
          return this.visitorSearch.searchByPersonId(prefix);
        }),
      ).subscribe(results => {
        this.editSearchLoading = false;
        if (results.length) {
          this.editVisitorSuggestions = results;
          this.editShowNoResults = false;
        } else {
          this.editVisitorSuggestions = [];
          this.editShowNoResults = true;
        }
        this.editSuggestionsVisible = true;
      });
    }
    this.editSearchSubject.next(value.trim());
  }

  onEditPersonIdFocus(): void {
    if (this.editVisitorSuggestions.length || this.editShowNoResults) {
      this.editSuggestionsVisible = true;
    }
  }

  onEditPersonIdBlur(): void {
    setTimeout(() => this.editSuggestionsVisible = false, 200);
  }

  selectEditVisitorSuggestion(visitor: VisitorSuggestion): void {
    if (!this.editingVisitor) return;
    this.editingVisitor.firstName = visitor.firstName;
    this.editingVisitor.lastName = visitor.lastName;
    this.editingVisitor.personId = visitor.personId;
    this.editingVisitor.phone = visitor.phone ?? '';
    this.editingVisitor.email = visitor.email ?? '';
    this.editingVisitor.carNumber = visitor.carNumber ?? '';
    this.editingVisitor.vehicleType = visitor.vehicleType ?? '';
    this.editingVisitor.hasVehicle = !!(visitor.carNumber);
    this.editVisitorSuggestions = [];
    this.editShowNoResults = false;
    this.editSuggestionsVisible = false;
    this.editBlacklistSubject.next(visitor.personId);
  }

  hasBlacklistedNewVisitor(): boolean {
    for (const [, status] of this.blacklistMap) {
      if (status.blacklisted) return true;
    }
    return false;
  }

  isDuplicateNewPersonId(index: number): boolean {
    const val = this.newVisitors[index]?.personId?.trim();
    if (!val) return false;
    if (this.newVisitors.some((v, i) => i !== index && v.personId?.trim() === val)) return true;
    return this.visitors.some(v => v.visitor?.personId?.trim() === val);
  }

  isDuplicateNewPhone(index: number): boolean {
    const val = this.newVisitors[index]?.phone?.trim();
    if (!val) return false;
    if (this.newVisitors.some((v, i) => i !== index && v.phone?.trim() === val)) return true;
    return this.visitors.some(v => v.visitor?.phone?.trim() === val);
  }

  private clearBlacklistState(): void {
    this.blacklistMap.clear();
    this.blacklistSubs.forEach(s => s.unsubscribe());
    this.blacklistSubs = [];
    this.blacklistSubjects.clear();
    this.editBlacklistStatus = null;
    this.editBlacklistSub?.unsubscribe();
    this.editBlacklistSub = null;
    this.visitorSuggestions.clear();
    this.showNoResults.clear();
    this.searchLoading.clear();
    this.suggestionsVisible.clear();
    this.searchSubs.forEach(s => s.unsubscribe());
    this.searchSubs = [];
    this.searchSubjects.clear();
    this.editVisitorSuggestions = [];
    this.editShowNoResults = false;
    this.editSearchLoading = false;
    this.editSuggestionsVisible = false;
    this.editSearchSub?.unsubscribe();
    this.editSearchSub = null;
  }

  // ── Print Card ──

  private initPrintListeners(): void {
    this.printService.initListeners();
    this.printSub = this.printService.state$.subscribe((state) => {
      if (state.status === 'completed') {
        this.notify.success(this.translateService.instant('VISITS.PRINT_CARD_SUCCESS'));
        this.printingVisitorId = null;
      } else if (state.status === 'failed') {
        const message = state.errorMessage
          ? (/^[A-Z][A-Z0-9_.]+$/.test(state.errorMessage)
              ? this.translateService.instant(state.errorMessage)
              : state.errorMessage)
          : this.translateService.instant('VISITS.PRINT_CARD_FAILED');
        this.notify.error(message);
        this.printingVisitorId = null;
      }
    });
    this.deviceSub = this.deviceStatus.devices$.subscribe((devices) => {
      this.isPrinterConnected = devices.some(
        (d) => d.providerType === 'printer' && d.isConnected,
      );
    });
  }

  isPrinterAvailable(): boolean {
    return this.workstationSession.currentState.bound && this.workstationSession.isPrinterConnected();
  }

  getPrintCardTooltip(): string {
    if (!this.workstationSession.currentState.bound) {
      return this.translateService.instant('VISITS.PRINT_CARD_NO_WORKSTATION');
    }
    if (!this.workstationSession.isPrinterConnected()) {
      return this.translateService.instant('VISITS.PRINT_CARD_NO_PRINTER');
    }
    return this.translateService.instant('VISITS.PRINT_CARD');
  }

  printCard(vv: VisitVisitor): void {
    if (this.printingVisitorId || !vv.visitorId || !this.isPrinterAvailable()) return;
    this.printingVisitorId = vv.id;
    this.printService.requestPrint({
      visitId: this.visitId,
      visitorId: vv.visitorId,
    });
  }

  ngOnDestroy(): void {
    this.clearBlacklistState();
    this.clearAdEscortState();
    this.printSub?.unsubscribe();
    this.deviceSub?.unsubscribe();
  }

  // ── AD People Search for Escorts ──

  onNewEscortNameChange(index: number, value: string): void {
    if (!value || value.trim().length < 2) {
      this.adEscortSuggestions.delete(index);
      this.adEscortNoResults.delete(index);
      this.adEscortLoading.delete(index);
      this.adEscortError.delete(index);
      return;
    }
    let subj = this.adEscortSubjects.get(index);
    if (!subj) {
      subj = new Subject<string>();
      this.adEscortSubjects.set(index, subj);
      const sub = subj.pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(q => {
          if (q.length < 2) { this.adEscortSuggestions.delete(index); return EMPTY; }
          this.adEscortLoading.set(index, true);
          this.adEscortError.delete(index);
          return this.adSearch.searchPeople(q).pipe(
            catchError(err => {
              this.adEscortSuggestions.delete(index);
              this.adEscortNoResults.delete(index);
              this.adEscortError.set(index, this.getAdErrorKey(err));
              this.adEscortVisible.set(index, true);
              return EMPTY;
            }),
            finalize(() => { this.adEscortLoading.delete(index); }),
          );
        }),
      ).subscribe(results => {
        if (results.length) {
          this.adEscortSuggestions.set(index, results);
          this.adEscortNoResults.delete(index);
        } else {
          this.adEscortSuggestions.delete(index);
          this.adEscortNoResults.set(index, true);
        }
        this.adEscortVisible.set(index, true);
      });
      this.adEscortSubs.push(sub);
    }
    subj.next(value.trim());
  }

  onNewEscortNameFocus(index: number, field: 'first' | 'last'): void {
    this.adEscortActiveField.set(index, field);
    if (this.adEscortSuggestions.has(index) || this.adEscortNoResults.has(index) || this.adEscortError.has(index)) {
      this.adEscortVisible.set(index, true);
    }
  }

  onNewEscortNameBlur(index: number): void {
    setTimeout(() => this.adEscortVisible.delete(index), 200);
  }

  selectNewEscortSuggestion(index: number, person: AdPersonSuggestion): void {
    const e = this.newEscorts[index];
    if (!e) return;
    e.firstName = person.firstName;
    e.lastName = person.lastName;
    e.email = person.email ?? '';
    e.phone = person.phone ?? '';
    this.adEscortSuggestions.delete(index);
    this.adEscortVisible.delete(index);
    this.adEscortNoResults.delete(index);
    this.adEscortError.delete(index);
    this.adEscortActiveField.delete(index);
  }

  onEditEscortNameChange(value: string): void {
    if (!value || value.trim().length < 2) {
      this.adEditEscortSuggestions = [];
      this.adEditEscortNoResults = false;
      this.adEditEscortLoading = false;
      this.adEditEscortError = '';
      return;
    }
    if (!this.adEditEscortSub) {
      this.adEditEscortSub = this.adEditEscortSubject.pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(q => {
          if (q.length < 2) { this.adEditEscortSuggestions = []; return EMPTY; }
          this.adEditEscortLoading = true;
          this.adEditEscortError = '';
          return this.adSearch.searchPeople(q).pipe(
            catchError(err => {
              this.adEditEscortSuggestions = [];
              this.adEditEscortNoResults = false;
              this.adEditEscortError = this.getAdErrorKey(err);
              this.adEditEscortVisible = true;
              return EMPTY;
            }),
            finalize(() => { this.adEditEscortLoading = false; }),
          );
        }),
      ).subscribe(results => {
        this.adEditEscortSuggestions = results;
        this.adEditEscortNoResults = results.length === 0;
        this.adEditEscortVisible = true;
      });
    }
    this.adEditEscortSubject.next(value.trim());
  }

  onEditEscortNameFocus(field: 'first' | 'last'): void {
    this.adEditEscortActiveField = field;
    if (this.adEditEscortSuggestions.length || this.adEditEscortNoResults || this.adEditEscortError) {
      this.adEditEscortVisible = true;
    }
  }

  onEditEscortNameBlur(): void {
    setTimeout(() => this.adEditEscortVisible = false, 200);
  }

  selectEditEscortSuggestion(person: AdPersonSuggestion): void {
    if (!this.editingEscort) return;
    this.editingEscort.firstName = person.firstName;
    this.editingEscort.lastName = person.lastName;
    this.editingEscort.email = person.email ?? '';
    this.editingEscort.phone = person.phone ?? '';
    this.adEditEscortSuggestions = [];
    this.adEditEscortVisible = false;
    this.adEditEscortNoResults = false;
    this.adEditEscortError = '';
    this.adEditEscortActiveField = '';
  }

  private getAdErrorKey(err: any): string {
    const code = err?.error?.code;
    if (code === 'AD_NO_CONFIG') return 'AD_SEARCH.ERROR_NO_CONFIG';
    return 'AD_SEARCH.ERROR_SEARCH_FAILED';
  }

  private clearAdEscortState(): void {
    this.adEscortSuggestions.clear();
    this.adEscortLoading.clear();
    this.adEscortVisible.clear();
    this.adEscortNoResults.clear();
    this.adEscortError.clear();
    this.adEscortActiveField.clear();
    this.adEscortSubs.forEach(s => s.unsubscribe());
    this.adEscortSubs = [];
    this.adEscortSubjects.clear();
    this.adEditEscortSuggestions = [];
    this.adEditEscortLoading = false;
    this.adEditEscortVisible = false;
    this.adEditEscortNoResults = false;
    this.adEditEscortError = '';
    this.adEditEscortActiveField = '';
    this.adEditEscortSub?.unsubscribe();
    this.adEditEscortSub = undefined;
    this.adEditEscortSubject = new Subject<string>();
  }

  // ── Check-In Code Actions ──

  resendCheckInCode(vv: VisitVisitor): void {
    if (!this.ensurePermission('visits.check-in-code.send')) return;
    this.visitsApi.resendCheckInCode(vv.id).subscribe({
      next: (result) => {
        this.notify.success(result.sent ? 'VISITS.CODE_RESENT' : 'VISITS.CODE_RESEND_FAILED');
      },
      error: (err) => this.notify.error(err),
    });
  }

  regenerateCheckInCode(vv: VisitVisitor): void {
    if (!this.ensurePermission('visits.check-in-code.regenerate')) return;
    this.visitsApi.regenerateCheckInCode(vv.id).subscribe({
      next: (newCode) => {
        this.codeMap.set(vv.id, newCode.code);
        this.notify.success('VISITS.CODE_REGENERATED');
      },
      error: (err) => this.notify.error(err),
    });
  }

  onAddVisitorDialogHide(): void {
    this.newVisitors = [];
    this.importErrors = [];
  }

  onAddEscortDialogHide(): void {
    this.newEscorts = [];
  }

  onEditVisitorDialogHide(): void {
    this.editingVisitor = null;
  }

  onEditEscortDialogHide(): void {
    this.editingEscort = null;
  }

  // ── Files ──

  loadFiles(): void {
    this.loadingFiles = true;
    this.visitsApi.getVisitFiles(this.visitId).subscribe({
      next: (files) => { this.visitFiles = files; this.loadingFiles = false; },
      error: () => { this.loadingFiles = false; },
    });
  }

  onVisitFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files.length) return;
    const files = Array.from(input.files);
    input.value = '';
    this.visitsApi.uploadVisitFiles(this.visitId, files).subscribe({
      next: () => { this.loadFiles(); this.notify.success('COMMON.SUCCESS'); },
      error: (err) => this.notify.error(err),
    });
  }

  downloadFile(file: import('../services/visits-api.service').VisitFileItem): void {
    this.visitsApi.downloadVisitFile(this.visitId, file.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.originalName;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => this.notify.error(err),
    });
  }

  deleteFile(file: import('../services/visits-api.service').VisitFileItem): void {
    this.visitsApi.deleteVisitFile(this.visitId, file.id).subscribe({
      next: () => { this.visitFiles = this.visitFiles.filter(f => f.id !== file.id); this.notify.success('COMMON.SUCCESS'); },
      error: (err) => this.notify.error(err),
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
