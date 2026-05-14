import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, inject } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { ApiService } from '@core/api/api.service';
import { VisitsApiService } from '../services/visits-api.service';
import { NotificationService } from '@core/notifications/notification.service';
import { ExcelImportService } from '@core/services/excel-import.service';
import { BlacklistCheckService } from '@core/services/blacklist-check.service';
import { VisitorSearchService, VisitorSuggestion } from '@core/services/visitor-search.service';
import { SystemUserSearchService, SystemUserSuggestion } from '@core/services/system-user-search.service';
import { SectorsLookupService, SectorLookupItem } from '@core/services/sectors-lookup.service';
import { Subject, Subscription, EMPTY } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize } from 'rxjs/operators';
import { Visit, InlineVisitor, InlineEscort } from '@core/models/entities.model';
import { VehicleModelsApiService } from '../../settings/services/vehicle-models-api.service';
import { Building as BuildingItem } from '../../settings/services/buildings-api.service';
import { EMAIL_PATTERN } from '@shared/constants/regex.constants';
import { PermissionService } from '@core/permissions/permission.service';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-visit-dialog',
  standalone: true,
  imports: [
    TranslateModule,
    FormsModule,
    DialogModule,
    DropdownModule,
    CalendarModule,
    InputTextModule,
    CheckboxModule,
  ],
  animations: [
    trigger('slideSection', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-8px)', maxHeight: '0px', overflow: 'hidden' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)', maxHeight: '800px' })),
      ]),
      transition(':leave', [
        style({ opacity: 1, transform: 'translateY(0)', maxHeight: '800px', overflow: 'hidden' }),
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-8px)', maxHeight: '0px' })),
      ]),
    ]),
  ],
  template: `
    <p-dialog [header]="editing ? ('VISITS.EDIT_VISIT' | translate) : ('VISITS.CREATE_VISIT' | translate)"
      [(visible)]="visible" (onHide)="onDialogHide()" (visibleChange)="visibleChange.emit($event)" [modal]="true" [style]="{width: editing ? '850px' : '95vw', maxWidth: editing ? '850px' : '1400px', maxHeight: '90vh'}" [draggable]="false">
      @if (visible) {
      @if (editing) {
        <!-- Edit mode: single-column layout (no visitors/escorts) -->
        <div class="dialog-form">
          <div class="section-divider first">
            <span class="section-label"><i class="pi pi-calendar"></i> {{ 'VISITS.VISIT_DETAILS' | translate }}</span>
          </div>
          <div class="form-row">
            <div class="field">
              <label><i class="pi pi-tag"></i> {{ 'VISITS.VISIT_TITLE' | translate }} <span class="required">*</span></label>
              <input type="text" [(ngModel)]="form.title" required #titleFieldEdit="ngModel" [placeholder]="'PLACEHOLDER.ENTER_VISIT_TITLE' | translate" />
              @if (titleFieldEdit.invalid && titleFieldEdit.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
            </div>
            <div class="field">
              <label><i class="pi pi-info-circle"></i> {{ 'VISITS.PURPOSE_OF_VISIT' | translate }}</label>
              <p-dropdown [(ngModel)]="form.purposeOfVisit" [options]="purposeOfVisitOptions" optionLabel="label" optionValue="value"
                [placeholder]="'PLACEHOLDER.ENTER_PURPOSE_OF_VISIT' | translate" appendTo="body" [showClear]="true"
                [style]="{ width: '100%' }"></p-dropdown>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label><i class="pi pi-building"></i> {{ 'BUILDINGS.BUILDING' | translate }} <span class="required">*</span></label>
              <p-dropdown [(ngModel)]="form.buildingId" [options]="buildings" optionLabel="name" optionValue="id"
                [placeholder]="'BUILDINGS.SELECT_BUILDING' | translate" appendTo="body"
                [style]="{'width':'100%'}" required #buildingFieldEdit="ngModel"
                [class.input-invalid]="buildingFieldEdit.invalid && buildingFieldEdit.touched"></p-dropdown>
              @if (buildingFieldEdit.invalid && buildingFieldEdit.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
            </div>
            <div class="field">
              <label><i class="pi pi-th-large"></i> {{ 'VISITS.FLOOR' | translate }} <span class="required">*</span></label>
              <input type="number" [(ngModel)]="form.floor" [placeholder]="'PLACEHOLDER.ENTER_FLOOR' | translate" required #floorFieldEdit="ngModel" />
              @if (floorFieldEdit.invalid && floorFieldEdit.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label><i class="pi pi-sitemap"></i> {{ 'VISITS.SECTOR' | translate }}</label>
              <input type="text" [value]="currentSectorName" disabled [placeholder]="'VISITS.SECTOR' | translate" />
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label><i class="pi pi-calendar"></i> {{ 'VISITS.PLANNED_START_DATE' | translate }} <span class="required">*</span></label>
              <p-calendar [(ngModel)]="form.plannedStartDate" [dateFormat]="'dd/mm/yy'" [showIcon]="true" [placeholder]="'VISITS.PLANNED_START_DATE' | translate" required #startDateFieldEdit="ngModel" appendTo="body" [style]="{'width':'100%'}" [inputStyle]="{'width':'100%'}"></p-calendar>
              @if (startDateFieldEdit.invalid && startDateFieldEdit.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
            </div>
            <div class="field">
              <label><i class="pi pi-clock"></i> {{ 'VISITS.PLANNED_START_TIME' | translate }} <span class="required">*</span></label>
              <p-calendar [(ngModel)]="form.plannedStartTime" [timeOnly]="true" [showIcon]="true" icon="pi pi-clock" [placeholder]="'VISITS.PLANNED_START_TIME' | translate" required #startTimeFieldEdit="ngModel" appendTo="body" [style]="{'width':'100%'}" [inputStyle]="{'width':'100%'}"></p-calendar>
              @if (startTimeFieldEdit.invalid && startTimeFieldEdit.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label><i class="pi pi-calendar"></i> {{ 'VISITS.PLANNED_END_DATE' | translate }} <span class="required">*</span></label>
              <p-calendar [(ngModel)]="form.plannedEndDate" [dateFormat]="'dd/mm/yy'" [showIcon]="true" [placeholder]="'VISITS.PLANNED_END_DATE' | translate" [minDate]="form.plannedStartDate" required #endDateFieldEdit="ngModel" appendTo="body" [style]="{'width':'100%'}" [inputStyle]="{'width':'100%'}"></p-calendar>
              @if (endDateFieldEdit.invalid && endDateFieldEdit.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
              @if (endBeforeStartError()) {
                <small class="field-error">{{ 'VALIDATION.END_BEFORE_START' | translate }}</small>
              }
            </div>
            <div class="field">
              <label><i class="pi pi-clock"></i> {{ 'VISITS.PLANNED_END_TIME' | translate }} <span class="required">*</span></label>
              <p-calendar [(ngModel)]="form.plannedEndTime" [timeOnly]="true" [showIcon]="true" icon="pi pi-clock" [placeholder]="'VISITS.PLANNED_END_TIME' | translate" required #endTimeFieldEdit="ngModel" appendTo="body" [style]="{'width':'100%'}" [inputStyle]="{'width':'100%'}"></p-calendar>
              @if (endTimeFieldEdit.invalid && endTimeFieldEdit.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
            </div>
          </div>
          <div class="section-divider">
            <span class="section-label"><i class="pi pi-user"></i> {{ 'VISITS.VISIT_REQUESTER' | translate }}</span>
          </div>
          <div class="field checkbox-field requester-toggle">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="requesterIsSomeoneElse" (ngModelChange)="onRequesterCheckboxChange()" [disabled]="requesterLockedToOnBehalf" />
              <i class="pi pi-user-edit"></i>
              {{ 'VISITS.REQUESTER_IS_SOMEONE_ELSE' | translate }}
            </label>
            @if (requesterLockedToOnBehalf) {
              <small class="field-warning"><i class="pi pi-info-circle"></i> {{ 'VISITS.ON_BEHALF_ONLY_REQUIRED' | translate }}</small>
            }
          </div>
          @if (requesterIsSomeoneElse) {
          <div class="requester-section" @slideSection>
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-user"></i> {{ 'VISITS.FIRST_NAME' | translate }} <span class="required">*</span></label>
                <div class="input-wrapper">
                  <input type="text" [(ngModel)]="visitRequester.firstName" required #obFirstNameEdit="ngModel"
                    (ngModelChange)="onRequesterNameChange($event)"
                    (focus)="onRequesterFocus('first')"
                    (blur)="onRequesterBlur()"
                    [placeholder]="'PLACEHOLDER.ENTER_FIRST_NAME' | translate" autocomplete="off" />
                  @if (adRequesterLoading) {
                    <i class="pi pi-spin pi-spinner input-spinner"></i>
                  }
                </div>
                @if (adRequesterVisible && adRequesterActiveField === 'first' && adRequesterSuggestions.length) {
                  <div class="suggestions-panel">
                    @for (p of adRequesterSuggestions; track $index) {
                      <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectRequesterSuggestion(p)">
                        <div class="suggestion-main">
                              <span class="suggestion-name">{{ p.firstName }} {{ p.lastName }}</span>
                        </div>
                        <div class="suggestion-secondary">
                          @if (p.sectorName) { <span>{{ p.sectorName }}</span> }
                          @if (p.email) { <span>{{ p.email }}</span> }
                          @if (p.phone) { <span>{{ p.phone }}</span> }
                        </div>
                      </div>
                    }
                  </div>
                } @else if (adRequesterVisible && adRequesterActiveField === 'first' && adRequesterError) {
                  <div class="suggestions-panel">
                    <div class="suggestion-error"><i class="pi pi-exclamation-circle"></i> {{ adRequesterError | translate }}</div>
                  </div>
                } @else if (adRequesterVisible && adRequesterActiveField === 'first' && adRequesterNoResults) {
                  <div class="suggestions-panel">
                    <div class="suggestion-no-results">{{ 'AD_SEARCH.NO_RESULTS' | translate }}</div>
                  </div>
                }
                @if (obFirstNameEdit.invalid && obFirstNameEdit.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
              <div class="field">
                <label><i class="pi pi-user"></i> {{ 'VISITS.LAST_NAME' | translate }} <span class="required">*</span></label>
              <div class="input-wrapper">
                <input type="text" [(ngModel)]="visitRequester.lastName" required #obLastNameEdit="ngModel"
                  (ngModelChange)="onRequesterNameChange($event)"
                  (focus)="onRequesterFocus('last')"
                  (blur)="onRequesterBlur()"
                  [placeholder]="'PLACEHOLDER.ENTER_LAST_NAME' | translate" autocomplete="off" />
                @if (adRequesterLoading) {
                  <i class="pi pi-spin pi-spinner input-spinner"></i>
                }
              </div>
              @if (adRequesterVisible && adRequesterActiveField === 'last' && adRequesterSuggestions.length) {
                <div class="suggestions-panel">
                  @for (p of adRequesterSuggestions; track $index) {
                    <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectRequesterSuggestion(p)">
                      <div class="suggestion-main">
                        <span class="suggestion-name">{{ p.firstName }} {{ p.lastName }}</span>
                      </div>
                      <div class="suggestion-secondary">
                        @if (p.sectorName) { <span>{{ p.sectorName }}</span> }
                        @if (p.email) { <span>{{ p.email }}</span> }
                        @if (p.phone) { <span>{{ p.phone }}</span> }
                      </div>
                    </div>
                  }
                </div>
              } @else if (adRequesterVisible && adRequesterActiveField === 'last' && adRequesterError) {
                <div class="suggestions-panel">
                  <div class="suggestion-error"><i class="pi pi-exclamation-circle"></i> {{ adRequesterError | translate }}</div>
                </div>
              } @else if (adRequesterVisible && adRequesterActiveField === 'last' && adRequesterNoResults) {
                <div class="suggestions-panel">
                  <div class="suggestion-no-results">{{ 'AD_SEARCH.NO_RESULTS' | translate }}</div>
                </div>
              }
              @if (obLastNameEdit.invalid && obLastNameEdit.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              }
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-phone"></i> {{ 'VISITS.PHONE' | translate }} <span class="required">*</span></label>
                <input type="text" [(ngModel)]="visitRequester.phone" required #obPhoneEdit="ngModel" [placeholder]="'PLACEHOLDER.ENTER_PHONE' | translate" />
                @if (obPhoneEdit.invalid && obPhoneEdit.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
              <div class="field">
                <label><i class="pi pi-envelope"></i> {{ 'VISITS.EMAIL' | translate }} <span class="required">*</span></label>
              <input type="email" [(ngModel)]="visitRequester.email" required [pattern]="emailPattern" #obEmailEdit="ngModel" [placeholder]="'PLACEHOLDER.ENTER_EMAIL' | translate" />
              @if (obEmailEdit.hasError('required') && obEmailEdit.touched) {
                <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
              } @else if (obEmailEdit.hasError('pattern') && obEmailEdit.touched) {
                <small class="field-error">{{ 'VALIDATION.EMAIL' | translate }}</small>
              }
            </div>
          </div>
          </div>
          }
        </div>
      } @else {
        <!-- Create mode: two-column layout -->
        <div class="dialog-split">
          <!-- LEFT: Visitors -->
          <div class="dialog-col dialog-col-left">
            <div class="section-divider first">
              <span class="section-label"><i class="pi pi-users"></i> {{ 'VISITS.VISITORS' | translate }}</span>
            </div>
            @if (!inlineVisitors.length) {
              <div class="validation-hint"><i class="pi pi-info-circle"></i> {{ 'VALIDATION.MIN_VISITORS' | translate }}</div>
            }
            @for (v of inlineVisitors; track $index) {
              <div class="inline-row">
                <div class="inline-row-header">
                  <span class="inline-row-num">{{ 'VISITS.VISITOR' | translate }} {{ $index + 1 }}</span>
                  <button class="btn-icon danger" (click)="removeInlineVisitor($index)" [title]="'COMMON.DELETE' | translate">
                    <i class="pi pi-times"></i>
                  </button>
                </div>
                <div class="form-row">
                  <div class="field">
                    <label><i class="pi pi-id-card"></i> {{ 'VISITORS.PERSON_ID' | translate }} <span class="required">*</span></label>
                    <div class="input-wrapper">
                      <input type="text" [(ngModel)]="v.personId" required pattern="[0-9]*" #vPersonId="ngModel"
                        (ngModelChange)="onPersonIdChange($index, $event)"
                        (focus)="onPersonIdFocus($index)"
                        (blur)="onPersonIdBlur($index)"
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
                          <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectSuggestion(inlineVisitors.indexOf(v), s)">
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
                    @if (isDuplicatePersonId($index)) {
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
                    @if (isDuplicatePhone($index)) {
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
                    <input type="checkbox" [(ngModel)]="v.hasVehicle" (ngModelChange)="onVehicleCheckboxChange(v)" />
                    <i class="pi pi-car"></i>
                    {{ 'VISITORS.HAS_VEHICLE' | translate }}
                  </label>
                </div>
                @if (v.hasVehicle) {
                <div class="vehicle-section" @slideSection>
                  <div class="form-row">
                    <div class="field">
                      <label><i class="pi pi-car"></i> {{ 'VISITORS.CAR_NUMBER' | translate }} <span class="required">*</span></label>
                      <div class="input-wrapper">
                        <input type="text" [(ngModel)]="v.carNumber" required #vCarNumber="ngModel"
                          [placeholder]="'PLACEHOLDER.ENTER_CAR_NUMBER' | translate" />
                      </div>
                      @if (vCarNumber.invalid && vCarNumber.touched) {
                        <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                      }
                    </div>
                    <div class="field">
                      <label><i class="pi pi-car"></i> {{ 'VISITORS.VEHICLE_TYPE' | translate }} <span class="required">*</span></label>
                      <p-dropdown
                        [(ngModel)]="v.vehicleType"
                        [options]="vehicleTypeOptions"
                        [group]="true"
                        optionGroupLabel="label"
                        optionGroupChildren="items"
                        optionLabel="label"
                        optionValue="value"
                        [placeholder]="'VISITORS.SELECT_VEHICLE_TYPE' | translate"
                        [filter]="true"
                        filterBy="label"
                        panelStyleClass="vehicle-type-panel"
                        appendTo="body"
                        [style]="{'width':'100%'}"
                        required
                        #vVehicleType="ngModel"
                      ></p-dropdown>
                      @if (vVehicleType.invalid && vVehicleType.touched) {
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
              <button class="btn btn-secondary btn-add-inline" (click)="addInlineVisitor()">
                <i class="pi pi-plus"></i> {{ 'VISITS.ADD_VISITOR' | translate }}
              </button>
              @if (canImportExcel) {
              <button class="btn btn-secondary btn-add-inline" (click)="visitorFileInput.click()">
                <i class="pi pi-file-excel"></i> {{ 'VISITS.IMPORT_VISITORS' | translate }}
              </button>
              }
            </div>
            <input #visitorFileInput type="file" accept=".xlsx,.xls" (change)="onVisitorFileSelected($event)" style="display:none" />
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

          <!-- RIGHT: Visit Details + Ordered By + Escorts -->
          <div class="dialog-col dialog-col-right">
            <div class="section-divider first">
              <span class="section-label"><i class="pi pi-calendar"></i> {{ 'VISITS.VISIT_DETAILS' | translate }}</span>
            </div>
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-tag"></i> {{ 'VISITS.VISIT_TITLE' | translate }} <span class="required">*</span></label>
                <input type="text" [(ngModel)]="form.title" required #titleField="ngModel" [placeholder]="'PLACEHOLDER.ENTER_VISIT_TITLE' | translate" />
                @if (titleField.invalid && titleField.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
              <div class="field">
                <label><i class="pi pi-info-circle"></i> {{ 'VISITS.PURPOSE_OF_VISIT' | translate }}</label>
                <p-dropdown [(ngModel)]="form.purposeOfVisit" [options]="purposeOfVisitOptions" optionLabel="label" optionValue="value"
                  [placeholder]="'PLACEHOLDER.ENTER_PURPOSE_OF_VISIT' | translate" appendTo="body" [showClear]="true"
                  [style]="{ width: '100%' }"></p-dropdown>
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-building"></i> {{ 'BUILDINGS.BUILDING' | translate }} <span class="required">*</span></label>
                <p-dropdown [(ngModel)]="form.buildingId" [options]="buildings" optionLabel="name" optionValue="id"
                  [placeholder]="'BUILDINGS.SELECT_BUILDING' | translate" appendTo="body"
                  [style]="{'width':'100%'}" required #buildingField="ngModel"
                  [class.input-invalid]="buildingField.invalid && buildingField.touched"></p-dropdown>
                @if (buildingField.invalid && buildingField.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
              <div class="field">
                <label><i class="pi pi-th-large"></i> {{ 'VISITS.FLOOR' | translate }} <span class="required">*</span></label>
                <input type="number" [(ngModel)]="form.floor" [placeholder]="'PLACEHOLDER.ENTER_FLOOR' | translate" required #floorField="ngModel" />
                @if (floorField.invalid && floorField.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-sitemap"></i> {{ 'VISITS.SECTOR' | translate }}</label>
                <input type="text" [value]="currentSectorName" disabled [placeholder]="'VISITS.SECTOR' | translate" />
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-calendar"></i> {{ 'VISITS.PLANNED_START_DATE' | translate }} <span class="required">*</span></label>
                <p-calendar [(ngModel)]="form.plannedStartDate" [dateFormat]="'dd/mm/yy'" [showIcon]="true" [placeholder]="'VISITS.PLANNED_START_DATE' | translate" [minDate]="today" required #startDateField="ngModel" appendTo="body" [style]="{'width':'100%'}" [inputStyle]="{'width':'100%'}"></p-calendar>
                @if (startDateField.invalid && startDateField.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
                @if (startDateInPastError()) {
                  <small class="field-error">{{ 'VALIDATION.DATE_NOT_IN_PAST' | translate }}</small>
                }
              </div>
              <div class="field">
                <label><i class="pi pi-clock"></i> {{ 'VISITS.PLANNED_START_TIME' | translate }} <span class="required">*</span></label>
                <p-calendar [(ngModel)]="form.plannedStartTime" [timeOnly]="true" [showIcon]="true" icon="pi pi-clock" [placeholder]="'VISITS.PLANNED_START_TIME' | translate" required #startTimeField="ngModel" appendTo="body" [style]="{'width':'100%'}" [inputStyle]="{'width':'100%'}"></p-calendar>
                @if (startTimeField.invalid && startTimeField.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label><i class="pi pi-calendar"></i> {{ 'VISITS.PLANNED_END_DATE' | translate }} <span class="required">*</span></label>
                <p-calendar [(ngModel)]="form.plannedEndDate" [dateFormat]="'dd/mm/yy'" [showIcon]="true" [placeholder]="'VISITS.PLANNED_END_DATE' | translate" [minDate]="form.plannedStartDate" required #endDateField="ngModel" appendTo="body" [style]="{'width':'100%'}" [inputStyle]="{'width':'100%'}"></p-calendar>
                @if (endDateField.invalid && endDateField.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
              <div class="field">
                <label><i class="pi pi-clock"></i> {{ 'VISITS.PLANNED_END_TIME' | translate }} <span class="required">*</span></label>
                <p-calendar [(ngModel)]="form.plannedEndTime" [timeOnly]="true" [showIcon]="true" icon="pi pi-clock" [placeholder]="'VISITS.PLANNED_END_TIME' | translate" required #endTimeField="ngModel" appendTo="body" [style]="{'width':'100%'}" [inputStyle]="{'width':'100%'}"></p-calendar>
                @if (endTimeField.invalid && endTimeField.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
            </div>
            @if (endBeforeStartError()) {
              <small class="field-error">{{ 'VALIDATION.END_BEFORE_START' | translate }}</small>
            }

            <div class="section-divider">
              <span class="section-label"><i class="pi pi-user"></i> {{ 'VISITS.VISIT_REQUESTER' | translate }}</span>
            </div>
            <div class="field checkbox-field requester-toggle">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="requesterIsSomeoneElse" (ngModelChange)="onRequesterCheckboxChange()" [disabled]="requesterLockedToOnBehalf" />
                <i class="pi pi-user-edit"></i>
                {{ 'VISITS.REQUESTER_IS_SOMEONE_ELSE' | translate }}
              </label>
              @if (requesterLockedToOnBehalf) {
                <small class="field-warning"><i class="pi pi-info-circle"></i> {{ 'VISITS.ON_BEHALF_ONLY_REQUIRED' | translate }}</small>
              }
            </div>
            @if (requesterIsSomeoneElse) {
            <div class="requester-section" @slideSection>
              <div class="form-row">
                <div class="field">
                  <label><i class="pi pi-user"></i> {{ 'VISITS.FIRST_NAME' | translate }} <span class="required">*</span></label>
                <div class="input-wrapper">
                  <input type="text" [(ngModel)]="visitRequester.firstName" required #obFirstName="ngModel"
                    (ngModelChange)="onRequesterNameChange($event)"
                    (focus)="onRequesterFocus('first')"
                    (blur)="onRequesterBlur()"
                    [placeholder]="'PLACEHOLDER.ENTER_FIRST_NAME' | translate" autocomplete="off" />
                  @if (adRequesterLoading) {
                    <i class="pi pi-spin pi-spinner input-spinner"></i>
                  }
                </div>
                @if (adRequesterVisible && adRequesterActiveField === 'first' && adRequesterSuggestions.length) {
                  <div class="suggestions-panel">
                    @for (p of adRequesterSuggestions; track $index) {
                      <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectRequesterSuggestion(p)">
                        <div class="suggestion-main">
                          <span class="suggestion-name">{{ p.firstName }} {{ p.lastName }}</span>
                        </div>
                        <div class="suggestion-secondary">
                          @if (p.sectorName) { <span>{{ p.sectorName }}</span> }
                          @if (p.email) { <span>{{ p.email }}</span> }
                          @if (p.phone) { <span>{{ p.phone }}</span> }
                        </div>
                      </div>
                    }
                  </div>
                } @else if (adRequesterVisible && adRequesterActiveField === 'first' && adRequesterError) {
                  <div class="suggestions-panel">
                    <div class="suggestion-error"><i class="pi pi-exclamation-circle"></i> {{ adRequesterError | translate }}</div>
                  </div>
                } @else if (adRequesterVisible && adRequesterActiveField === 'first' && adRequesterNoResults) {
                  <div class="suggestions-panel">
                    <div class="suggestion-no-results">{{ 'AD_SEARCH.NO_RESULTS' | translate }}</div>
                  </div>
                }
                @if (obFirstName.invalid && obFirstName.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
              </div>
              <div class="field">
                <label><i class="pi pi-user"></i> {{ 'VISITS.LAST_NAME' | translate }} <span class="required">*</span></label>
                <div class="input-wrapper">
                  <input type="text" [(ngModel)]="visitRequester.lastName" required #obLastName="ngModel"
                    (ngModelChange)="onRequesterNameChange($event)"
                    (focus)="onRequesterFocus('last')"
                    (blur)="onRequesterBlur()"
                    [placeholder]="'PLACEHOLDER.ENTER_LAST_NAME' | translate" autocomplete="off" />
                  @if (adRequesterLoading) {
                    <i class="pi pi-spin pi-spinner input-spinner"></i>
                  }
                </div>
                @if (adRequesterVisible && adRequesterActiveField === 'last' && adRequesterSuggestions.length) {
                  <div class="suggestions-panel">
                    @for (p of adRequesterSuggestions; track $index) {
                      <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectRequesterSuggestion(p)">
                        <div class="suggestion-main">
                          <span class="suggestion-name">{{ p.firstName }} {{ p.lastName }}</span>
                        </div>
                        <div class="suggestion-secondary">
                          @if (p.sectorName) { <span>{{ p.sectorName }}</span> }
                          @if (p.email) { <span>{{ p.email }}</span> }
                          @if (p.phone) { <span>{{ p.phone }}</span> }
                        </div>
                      </div>
                    }
                  </div>
                } @else if (adRequesterVisible && adRequesterActiveField === 'last' && adRequesterError) {
                  <div class="suggestions-panel">
                    <div class="suggestion-error"><i class="pi pi-exclamation-circle"></i> {{ adRequesterError | translate }}</div>
                  </div>
                } @else if (adRequesterVisible && adRequesterActiveField === 'last' && adRequesterNoResults) {
                  <div class="suggestions-panel">
                    <div class="suggestion-no-results">{{ 'AD_SEARCH.NO_RESULTS' | translate }}</div>
                  </div>
                }
                @if (obLastName.invalid && obLastName.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                }
                </div>
              </div>
              <div class="form-row">
                <div class="field">
                  <label><i class="pi pi-phone"></i> {{ 'VISITS.PHONE' | translate }} <span class="required">*</span></label>
                  <input type="text" [(ngModel)]="visitRequester.phone" required #obPhone="ngModel" [placeholder]="'PLACEHOLDER.ENTER_PHONE' | translate" />
                  @if (obPhone.invalid && obPhone.touched) {
                    <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                  }
                </div>
                <div class="field">
                  <label><i class="pi pi-envelope"></i> {{ 'VISITS.EMAIL' | translate }} <span class="required">*</span></label>
                <input type="email" [(ngModel)]="visitRequester.email" required [pattern]="emailPattern" #obEmail="ngModel" [placeholder]="'PLACEHOLDER.ENTER_EMAIL' | translate" />
                @if (obEmail.hasError('required') && obEmail.touched) {
                  <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                } @else if (obEmail.hasError('pattern') && obEmail.touched) {
                  <small class="field-error">{{ 'VALIDATION.EMAIL' | translate }}</small>
                }
                </div>
              </div>
            </div>
            }

            <!-- Escorts Section -->
            <div class="section-divider">
              <span class="section-label"><i class="pi pi-shield"></i> {{ 'VISITS.ESCORTS' | translate }}</span>
            </div>
            @if (escortRequired && !inlineEscorts.length) {
              <div class="validation-hint validation-hint-error"><i class="pi pi-exclamation-circle"></i> {{ 'VALIDATION.MIN_ESCORT_REQUIRED' | translate }}</div>
            }
            @for (e of inlineEscorts; track $index) {
              <div class="inline-row">
                <div class="inline-row-header">
                  <span class="inline-row-num">{{ 'VISITS.ESCORT' | translate }} {{ $index + 1 }}</span>
                  <button class="btn-icon danger" (click)="removeInlineEscort($index)" [title]="'COMMON.DELETE' | translate">
                    <i class="pi pi-times"></i>
                  </button>
                </div>
                <div class="form-row">
                  <div class="field">
                    <label><i class="pi pi-user"></i> {{ 'VISITS.FIRST_NAME' | translate }} <span class="required">*</span></label>
                    <div class="input-wrapper">
                      <input type="text" [(ngModel)]="e.firstName" required #eFirstName="ngModel"
                        (ngModelChange)="onEscortNameChange($index, $event)"
                        (focus)="onEscortNameFocus($index, 'first')"
                        (blur)="onEscortNameBlur($index)"
                        [placeholder]="'PLACEHOLDER.ENTER_FIRST_NAME' | translate" autocomplete="off" />
                      @if (adEscortLoading.get($index)) {
                        <i class="pi pi-spin pi-spinner input-spinner"></i>
                      }
                    </div>
                    @if (adEscortVisible.get($index) && adEscortActiveField.get($index) === 'first' && adEscortSuggestions.get($index)?.length) {
                      <div class="suggestions-panel">
                        @for (p of adEscortSuggestions.get($index); track $index) {
                          <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectEscortSuggestion($index, p)">
                            <div class="suggestion-main">
                              <span class="suggestion-name">{{ p.firstName }} {{ p.lastName }}</span>
                            </div>
                            <div class="suggestion-secondary">
                              @if (p.sectorName) { <span>{{ p.sectorName }}</span> }
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
                    <label><i class="pi pi-user"></i> {{ 'VISITS.LAST_NAME' | translate }} <span class="required">*</span></label>
                    <div class="input-wrapper">
                      <input type="text" [(ngModel)]="e.lastName" required #eLastName="ngModel"
                        (ngModelChange)="onEscortNameChange($index, $event)"
                        (focus)="onEscortNameFocus($index, 'last')"
                        (blur)="onEscortNameBlur($index)"
                        [placeholder]="'PLACEHOLDER.ENTER_LAST_NAME' | translate" autocomplete="off" />
                      @if (adEscortLoading.get($index)) {
                        <i class="pi pi-spin pi-spinner input-spinner"></i>
                      }
                    </div>
                    @if (adEscortVisible.get($index) && adEscortActiveField.get($index) === 'last' && adEscortSuggestions.get($index)?.length) {
                      <div class="suggestions-panel">
                        @for (p of adEscortSuggestions.get($index); track $index) {
                          <div class="suggestion-item" (mousedown)="$event.preventDefault()" (click)="selectEscortSuggestion($index, p)">
                            <div class="suggestion-main">
                              <span class="suggestion-name">{{ p.firstName }} {{ p.lastName }}</span>
                            </div>
                            <div class="suggestion-secondary">
                              @if (p.sectorName) { <span>{{ p.sectorName }}</span> }
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
                    <label><i class="pi pi-phone"></i> {{ 'VISITS.PHONE' | translate }} <span class="required">*</span></label>
                    <input type="text" [(ngModel)]="e.phone" required #ePhone="ngModel" [placeholder]="'PLACEHOLDER.ENTER_PHONE' | translate" />
                    @if (ePhone.invalid && ePhone.touched) {
                      <small class="field-error">{{ 'VALIDATION.REQUIRED' | translate }}</small>
                    }
                  </div>
                  <div class="field">
                    <label><i class="pi pi-envelope"></i> {{ 'VISITS.EMAIL' | translate }} <span class="required">*</span></label>
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
                    <label><i class="pi pi-sitemap"></i> {{ 'VISITS.SECTOR' | translate }}</label>
                    <p-dropdown
                      [(ngModel)]="e.sector"
                      [options]="escortSectorOptions"
                      optionLabel="name"
                      optionValue="name"
                      [placeholder]="'VISITS.SECTOR' | translate"
                      appendTo="body"
                      [style]="{'width':'100%'}"
                    ></p-dropdown>
                  </div>
                </div>
              </div>
            }
            <button class="btn btn-secondary btn-add-inline" (click)="addInlineEscort()">
              <i class="pi pi-plus"></i> {{ 'VISITS.ADD_ESCORT' | translate }}
            </button>
          </div>
        </div>
      }
      }
      <ng-template pTemplate="footer">
        <button class="btn btn-secondary" (click)="close()" [disabled]="saving">{{ 'COMMON.CANCEL' | translate }}</button>
        <button class="btn btn-primary save-btn" (click)="save()" [disabled]="!isFormValid() || saving">
          @if (saving) {
            <i class="pi pi-spin pi-spinner"></i> {{ 'COMMON.SAVING' | translate }}
          } @else {
            <i class="pi pi-save"></i> {{ 'COMMON.SAVE' | translate }}
          }
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    /* ── Dialog layout ── */
    .dialog-form { display: flex; flex-direction: column; gap: 1rem; max-height: 70vh; overflow-y: auto; }
    .dialog-split { display: grid; grid-template-columns: 1fr 1fr; gap: 0; min-height: 0; }
    .dialog-col {
      display: flex; flex-direction: column; gap: 1rem;
      overflow-y: auto;
      padding: 0.25rem 0.5rem 0.25rem 0;
    }
    .dialog-col-left {
      border-inline-end: 1.5px solid var(--color-border, #e4e2f0);
      padding-inline-end: 1.5rem;
      margin-inline-end: 1.5rem;
    }
    @media (max-width: 992px) {
      .dialog-split { grid-template-columns: 1fr; }
      .dialog-col-left {
        border-inline-end: none;
        padding-inline-end: 0;
        margin-inline-end: 0;
        border-bottom: 1.5px solid var(--color-border, #e4e2f0);
        padding-bottom: 1.5rem;
        margin-bottom: 1rem;
      }
    }
    .visitor-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 600px) {
      .form-row { grid-template-columns: 1fr; }
    }
    .checkbox-field { margin-bottom: 0.25rem; }
    .checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; color: var(--color-text-primary); }
    .checkbox-label input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-primary); }

    /* ── Vehicle toggle + slide animation ── */
    .vehicle-toggle .checkbox-label { gap: 0.45rem; }
    .vehicle-toggle .checkbox-label i.pi-car { font-size: 0.95rem; color: var(--color-accent, #6c63ff); transition: color 0.2s; }
    .parking-toggle { padding-top: 0.5rem; }
    .parking-toggle .checkbox-label i.pi-warehouse { font-size: 0.95rem; color: var(--color-accent, #6c63ff); transition: color 0.2s; }
    .requester-toggle .checkbox-label i.pi-user-edit { font-size: 0.95rem; color: var(--color-accent, #6c63ff); transition: color 0.2s; }
    .vehicle-section {
      margin-top: 0.25rem;
    }
    .requester-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: var(--color-surface-alt, #f8f8fc);
      border: 1px solid var(--color-border, #e4e2f0);
      border-radius: 10px;
      padding: 0.85rem 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .requester-section:hover {
      border-color: var(--color-accent-subtle, #ddd9ff);
      box-shadow: 0 2px 8px rgba(108, 99, 255, 0.06);
    }
    .field label i { font-size: 0.82rem; color: var(--color-accent, #6c63ff); margin-inline-end: 0.2rem; }
    .dialog-form .field, .dialog-col .field { display: flex; flex-direction: column; gap: 0.3rem; }
    .dialog-form .field label, .dialog-col .field label { font-weight: 500; font-size: 0.85rem; color: var(--color-text-secondary); }

    /* ── Section headers ── */
    .section-divider {
      border-top: 1.5px solid var(--color-border, #e4e2f0);
      padding-top: 0.85rem;
      margin-top: 0.5rem;
    }
    .section-divider.first { border-top: none; padding-top: 0; margin-top: 0; }
    .section-label {
      display: flex; align-items: center; gap: 0.45rem;
      font-weight: 700; font-size: 0.88rem;
      color: var(--color-primary, #020140);
      letter-spacing: -0.01em;
    }
    .section-label i { color: var(--color-accent, #6c63ff); font-size: 0.95rem; }

    /* ── Inline visitor/escort cards ── */
    .inline-row {
      background: var(--color-surface-alt, #f8f8fc);
      border: 1px solid var(--color-border, #e4e2f0);
      border-radius: 10px;
      padding: 0.85rem 1rem;
      display: flex; flex-direction: column; gap: 0.6rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .inline-row:hover {
      border-color: var(--color-accent-subtle, #ddd9ff);
      box-shadow: 0 2px 8px rgba(108, 99, 255, 0.06);
    }
    .inline-row-header { display: flex; justify-content: space-between; align-items: center; }
    .inline-row-num {
      font-weight: 700; font-size: 0.8rem;
      color: var(--color-accent, #6c63ff);
      display: flex; align-items: center; gap: 0.3rem;
    }
    .btn-add-inline { align-self: flex-start; }

    /* ── Validation ── */
    .validation-hint {
      display: flex; align-items: center; gap: 0.45rem;
      padding: 0.65rem 0.95rem;
      background: #fffbeb; border: 1px solid #fde68a;
      border-radius: 8px; color: #b45309;
      font-size: 0.84rem; font-weight: 500;
    }
    .validation-hint.validation-hint-error {
      background: #fff1f2; border-color: #fecdd3; color: #dc2626;
    }
    .validation-hint i { font-size: 0.9rem; flex-shrink: 0; }
    .import-errors {
      background: #fff1f2; border: 1px solid #fecdd3;
      border-radius: 8px; padding: 0.75rem 0.85rem;
      margin-top: 0.5rem; font-size: 0.82rem;
    }
    .import-errors-header {
      display: flex; justify-content: space-between; align-items: center;
      font-weight: 600; color: #dc2626; margin-bottom: 0.4rem;
    }
    .import-errors-header span { display: flex; align-items: center; gap: 0.3rem; }
    .import-error-row { color: #7f1d1d; padding: 0.15rem 0; }
    .required { color: #dc2626; }
    .input-invalid { border-color: #dc2626 !important; }
    .input-warning { border-color: #d97706 !important; }
    ::ng-deep .input-invalid .p-dropdown,
    ::ng-deep p-dropdown.ng-invalid.ng-touched .p-dropdown { border-color: #dc2626 !important; }

    /* ── Autocomplete / search ── */
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
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      margin-top: 4px;
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

    /* ── Save button spinner ── */
    .save-btn { min-width: 110px; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
    .save-btn .pi-spinner { font-size: 0.85rem; }

    /* ── PrimeNG overrides ── */
    :host ::ng-deep .p-calendar { width: 100%; }
    :host ::ng-deep .p-calendar .p-inputtext { width: 100%; padding: 0.55rem 0.85rem; font-size: 0.9rem; }
    :host ::ng-deep .p-calendar .p-datepicker-trigger { padding: 0.55rem 0.65rem; }
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
    :host ::ng-deep .p-autocomplete { width: 100%; }
    :host ::ng-deep .p-autocomplete-input { width: 100% !important; }
  `],
})
export class VisitDialogComponent implements OnDestroy {
  private static readonly ON_BEHALF_ONLY_PERMISSION = 'visits.on-behalf-only';

  private el = inject(ElementRef);
  private api = inject(ApiService);
  private visitsApi = inject(VisitsApiService);
  private notify = inject(NotificationService);
  private excelImport = inject(ExcelImportService);
  private translate = inject(TranslateService);
  private blacklistCheck = inject(BlacklistCheckService);
  private visitorSearch = inject(VisitorSearchService);
  private systemUserSearch = inject(SystemUserSearchService);
  private sectorsLookup = inject(SectorsLookupService);
  private permissionService = inject(PermissionService);
  private authService = inject(AuthService);

  canRequestParking = false;
  canImportExcel = false;

  get escortRequired(): boolean {
    if (this.permissionService.hasPermission('visits.escort.required')) return true;
    if (
      this.permissionService.hasPermission('visits.escort.required.self-requester') &&
      !this.requesterIsSomeoneElse
    ) return true;
    return false;
  }

  get currentSectorName(): string {
    return this.authService.currentUser?.sector?.name ?? '';
  }

  @Input() visible = false;
  @Input() editing: Visit | null = null;
  @Input() buildings: BuildingItem[] = [];
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target) return;
    // If click is inside a suggestions-panel or its trigger input, ignore
    if (target.closest('.suggestions-panel') || target.closest('.input-wrapper')) return;
    this.closeAllSuggestions();
  }

  today = new Date();
  emailPattern = EMAIL_PATTERN.source;
  saving = false;
  purposeOfVisitOptions = [
    { label: 'פגישה', value: 'פגישה' },
    { label: 'כנס', value: 'כנס' },
    { label: 'עבודת תחזוקה', value: 'עבודת תחזוקה' },
    { label: 'אחר', value: 'אחר' },
  ];
  vehicleTypeOptions: { label: string; items: { label: string; value: string }[] }[] = [];
  escortSectorOptions: SectorLookupItem[] = [];

  private readonly vehicleModelsApi = inject(VehicleModelsApiService);

  private buildVehicleTypeOptions(): void {
    this.vehicleModelsApi.lookup().subscribe({
      next: (options) => this.vehicleTypeOptions = options,
      error: () => this.vehicleTypeOptions = [],
    });
  }

  form: {
    title: string;
    purposeOfVisit: string;
    buildingId: string;
    floor: number | null;
    plannedStartDate: Date | null;
    plannedStartTime: Date | null;
    plannedEndDate: Date | null;
    plannedEndTime: Date | null;
  } = {
      title: '',
      purposeOfVisit: '',
      buildingId: '',
      floor: null,
      plannedStartDate: null,
      plannedStartTime: null,
      plannedEndDate: null,
      plannedEndTime: null,
    };
  visitRequester = { firstName: '', lastName: '', phone: '', email: '' };
  requesterIsSomeoneElse = false;
  requesterLockedToOnBehalf = false;
  inlineVisitors: InlineVisitor[] = [];
  inlineEscorts: InlineEscort[] = [];
  importErrors: string[] = [];

  // Blacklist state
  blacklistMap = new Map<number, { checking: boolean; blacklisted: boolean; reason?: string }>();
  private blacklistSubjects = new Map<number, Subject<string>>();
  private blacklistSubs: Subscription[] = [];

  // Visitor search state
  visitorSuggestions = new Map<number, VisitorSuggestion[]>();
  showNoResults = new Map<number, boolean>();
  searchLoading = new Map<number, boolean>();
  suggestionsVisible = new Map<number, boolean>();
  private searchSubjects = new Map<number, Subject<string>>();
  private searchSubs: Subscription[] = [];

  // AD person search state — visit requester
  adRequesterSuggestions: SystemUserSuggestion[] = [];
  adRequesterLoading = false;
  adRequesterVisible = false;
  adRequesterNoResults = false;
  adRequesterError = '';
  adRequesterActiveField: 'first' | 'last' | '' = '';
  private adRequesterSubject = new Subject<string>();
  private adRequesterSub?: Subscription;

  // AD person search state — escorts (keyed by escort index)
  adEscortSuggestions = new Map<number, SystemUserSuggestion[]>();
  adEscortLoading = new Map<number, boolean>();
  adEscortVisible = new Map<number, boolean>();
  adEscortNoResults = new Map<number, boolean>();
  adEscortError = new Map<number, string>();
  adEscortActiveField = new Map<number, 'first' | 'last' | ''>();
  private adEscortSubjects = new Map<number, Subject<string>>();
  private adEscortSubs: Subscription[] = [];

  open(visit?: Visit): void {
    this.buildVehicleTypeOptions();
    this.loadEscortSectorOptions();
    this.resetDialogState();
    this.canRequestParking = this.permissionService.hasPermission('parking.request');
    this.canImportExcel = this.permissionService.hasPermission('visitors.import');
    this.requesterLockedToOnBehalf = this.permissionService.hasPermission(VisitDialogComponent.ON_BEHALF_ONLY_PERMISSION);
    this.editing = visit ?? null;
    if (visit) {
      const startDate = visit.plannedStartTimeUtc ? new Date(visit.plannedStartTimeUtc) : null;
      const endDate = visit.plannedEndTimeUtc ? new Date(visit.plannedEndTimeUtc) : null;
      this.form = {
        title: visit.title,
        purposeOfVisit: visit.purposeOfVisit ?? '',
        buildingId: visit.buildingId ?? '',
        floor: visit.floor ?? null,
        plannedStartDate: startDate,
        plannedStartTime: startDate,
        plannedEndDate: endDate,
        plannedEndTime: endDate,
      };
      this.visitRequester = visit.visitRequester
        ? { ...visit.visitRequester }
        : { firstName: '', lastName: '', phone: '', email: '' };
      this.requesterIsSomeoneElse = !visit.visitRequesterUserId;
      if (this.requesterLockedToOnBehalf) {
        this.requesterIsSomeoneElse = true;
      }
    } else {
      const defaultStart = new Date();
      defaultStart.setHours(8, 0, 0, 0);
      const defaultEnd = new Date();
      defaultEnd.setHours(17, 0, 0, 0);
      this.form.plannedStartTime = defaultStart;
      this.form.plannedEndTime = defaultEnd;
      this.requesterIsSomeoneElse = this.requesterLockedToOnBehalf;
      this.inlineVisitors = [{ firstName: '', lastName: '', email: '', phone: '', personId: '', hasVehicle: false, carNumber: '', vehicleType: '', requestParking: false }];
    }
    this.visible = true;
    this.visibleChange.emit(true);
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  onDialogHide(): void {
    this.resetDialogState();
  }

  private resetDialogState(): void {
    this.editing = null;
    this.form = { title: '', purposeOfVisit: '', buildingId: '', floor: null, plannedStartDate: null, plannedStartTime: null, plannedEndDate: null, plannedEndTime: null };
    this.visitRequester = { firstName: '', lastName: '', phone: '', email: '' };
    this.requesterIsSomeoneElse = false;
    this.requesterLockedToOnBehalf = false;
    this.inlineVisitors = [];
    this.inlineEscorts = [];
    this.importErrors = [];
    this.saving = false;
    this.clearBlacklistState();
    this.clearAdSearchState();
  }

  // ── Date/time helpers ──

  private combineDateTimeToIso(date: Date, time: Date): string {
    const combined = new Date(
      date.getFullYear(), date.getMonth(), date.getDate(),
      time.getHours(), time.getMinutes(),
    );
    return combined.toISOString();
  }

  startDateInPastError(): boolean {
    if (!this.form.plannedStartDate) return false;
    const selected = new Date(this.form.plannedStartDate.getFullYear(), this.form.plannedStartDate.getMonth(), this.form.plannedStartDate.getDate());
    const todayStart = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
    return selected < todayStart;
  }

  endBeforeStartError(): boolean {
    if (!this.form.plannedEndDate || !this.form.plannedEndTime) return false;
    if (!this.form.plannedStartDate || !this.form.plannedStartTime) return false;
    const start = new Date(
      this.form.plannedStartDate.getFullYear(), this.form.plannedStartDate.getMonth(), this.form.plannedStartDate.getDate(),
      this.form.plannedStartTime.getHours(), this.form.plannedStartTime.getMinutes(),
    );
    const end = new Date(
      this.form.plannedEndDate.getFullYear(), this.form.plannedEndDate.getMonth(), this.form.plannedEndDate.getDate(),
      this.form.plannedEndTime.getHours(), this.form.plannedEndTime.getMinutes(),
    );
    return end <= start;
  }

  // ── Validation ──

  onRequesterCheckboxChange(): void {
    if (this.requesterLockedToOnBehalf) {
      this.requesterIsSomeoneElse = true;
      return;
    }

    if (!this.requesterIsSomeoneElse) {
      this.visitRequester = { firstName: '', lastName: '', phone: '', email: '' };
    }
  }

  onVehicleCheckboxChange(v: InlineVisitor): void {
    if (!v.hasVehicle) {
      v.carNumber = '';
      v.vehicleType = '';
      v.requestParking = false;
    }
  }

  isFormValid(): boolean {
    if (!this.form.title || !this.form.buildingId || this.form.floor == null) return false;
    if (!this.form.plannedStartDate || !this.form.plannedStartTime) return false;
    if (!this.form.plannedEndDate || !this.form.plannedEndTime) return false;
    if (this.startDateInPastError()) return false;
    if (this.endBeforeStartError()) return false;
    if (this.requesterLockedToOnBehalf && !this.requesterIsSomeoneElse) return false;
    if (this.requesterIsSomeoneElse) {
      if (!this.visitRequester.firstName || !this.visitRequester.lastName || !this.visitRequester.phone || !this.visitRequester.email) return false;
      if (!EMAIL_PATTERN.test(this.visitRequester.email)) return false;
    }
    if (!this.editing) {
      if (!this.inlineVisitors.length) return false;
      for (const v of this.inlineVisitors) {
        if (!v.firstName || !v.lastName || !v.personId || !v.phone) return false;
        if (!/^[0-9]*$/.test(v.personId)) return false;
        if (v.email && !EMAIL_PATTERN.test(v.email)) return false;
        if (v.hasVehicle && (!v.carNumber || !v.vehicleType)) return false;
      }
      if (this.escortRequired && !this.inlineEscorts.length) return false;
      for (const e of this.inlineEscorts) {
        if (!e.firstName || !e.lastName || !e.phone || !e.email) return false;
        if (!EMAIL_PATTERN.test(e.email)) return false;
      }
    }
    return true;
  }

  // ── Inline visitor/escort management ──

  addInlineVisitor(): void {
    this.inlineVisitors.push({ firstName: '', lastName: '', email: '', phone: '', personId: '', hasVehicle: false, carNumber: '', vehicleType: '', requestParking: false });
  }

  removeInlineVisitor(index: number): void {
    this.inlineVisitors.splice(index, 1);
    this.blacklistMap.delete(index);
    this.visitorSuggestions.delete(index);
    this.showNoResults.delete(index);
    this.searchLoading.delete(index);
    this.suggestionsVisible.delete(index);
    // Reindex blacklist state
    const newMap = new Map<number, { checking: boolean; blacklisted: boolean; reason?: string }>();
    for (const [k, v] of this.blacklistMap) {
      newMap.set(k > index ? k - 1 : k, v);
    }
    this.blacklistMap = newMap;
    // Reindex suggestion state
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
        this.notify.error(this.translate.instant('VISITS.IMPORT_ALL_INVALID', { count: result.invalid.length }));
        this.importErrors = result.invalid.map(e =>
          this.translate.instant('VISITS.IMPORT_ROW_ERROR', { row: e.row, fields: e.errors.join(', ') })
        );
        return;
      }

      for (const row of result.valid) {
        this.inlineVisitors.push({
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
        this.notify.success(this.translate.instant('VISITS.IMPORT_PARTIAL', { valid: result.valid.length, invalid: result.invalid.length }));
        this.importErrors = result.invalid.map(e =>
          this.translate.instant('VISITS.IMPORT_ROW_ERROR', { row: e.row, fields: e.errors.join(', ') })
        );
      } else {
        this.notify.success(this.translate.instant('VISITS.IMPORT_SUCCESS', { count: result.valid.length }));
      }
    } catch {
      this.notify.error('VISITS.IMPORT_INVALID_FILE');
    }
  }

  addInlineEscort(): void {
    this.inlineEscorts.push({ firstName: '', lastName: '', phone: '', email: '', sector: '' });
  }

  removeInlineEscort(index: number): void {
    this.inlineEscorts.splice(index, 1);
  }

  // ── Save ──

  save(): void {
    const canSave = this.editing
      ? this.permissionService.hasPermission('visits.update')
      : this.permissionService.hasPermission('visits.create');
    if (!canSave) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    if (this.requesterLockedToOnBehalf && !this.requesterIsSomeoneElse) {
      this.notify.error('VISITS.ON_BEHALF_ONLY_REQUIRED');
      return;
    }
    if (!this.isFormValid()) return;
    this.saving = true;

    const visitRequesterPayload = this.requesterIsSomeoneElse
      ? {
        firstName: this.visitRequester.firstName,
        lastName: this.visitRequester.lastName,
        phone: this.visitRequester.phone,
        email: this.visitRequester.email,
      }
      : undefined;

    if (this.editing) {
      const body: any = {
        title: this.form.title,
        purposeOfVisit: this.form.purposeOfVisit || null,
        buildingId: this.form.buildingId,
        floor: this.form.floor,
        plannedStartTimeUtc: this.combineDateTimeToIso(this.form.plannedStartDate!, this.form.plannedStartTime!),
        plannedEndTimeUtc: this.combineDateTimeToIso(this.form.plannedEndDate!, this.form.plannedEndTime!),
        ...(visitRequesterPayload ? { visitRequester: visitRequesterPayload } : { visitRequester: null }),
      };
      this.visitsApi.updateVisit(this.editing.id, body).subscribe({
        next: () => { this.close(); this.notify.success('COMMON.SUCCESS'); this.saved.emit(); },
        error: (err) => { this.saving = false; this.notify.error(err); },
      });
    } else {
      const body: any = {
        title: this.form.title,
        purposeOfVisit: this.form.purposeOfVisit || null,
        buildingId: this.form.buildingId,
        floor: this.form.floor,
        plannedStartTimeUtc: this.combineDateTimeToIso(this.form.plannedStartDate!, this.form.plannedStartTime!),
        plannedEndTimeUtc: this.combineDateTimeToIso(this.form.plannedEndDate!, this.form.plannedEndTime!),
        ...(visitRequesterPayload ? { visitRequester: visitRequesterPayload } : {}),
        visitors: this.inlineVisitors.map(v => ({
          firstName: v.firstName,
          lastName: v.lastName,
          email: v.email || undefined,
          phone: v.phone || undefined,
          personId: v.personId,
          hasVehicle: v.hasVehicle,
          carNumber: v.hasVehicle ? (v.carNumber || undefined) : undefined,
          vehicleType: v.hasVehicle ? (v.vehicleType || undefined) : undefined,
          requestParking: v.hasVehicle ? v.requestParking : undefined,
        })),
        escorts: this.inlineEscorts.map(e => ({
          firstName: e.firstName,
          lastName: e.lastName,
          phone: e.phone,
          email: e.email,
          sector: e.sector || undefined,
        })),
      };
      this.visitsApi.createVisit(body).subscribe({
        next: () => { this.close(); this.notify.success('COMMON.SUCCESS'); this.saved.emit(); },
        error: (err) => { this.saving = false; this.notify.error(err); },
      });
    }
  }

  // ── Blacklist validation ──

  onPersonIdChange(index: number, value: string): void {
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

  onPersonIdFocus(index: number): void {
    if (this.visitorSuggestions.has(index) || this.showNoResults.has(index)) {
      this.suggestionsVisible.set(index, true);
    }
  }

  onPersonIdBlur(index: number): void {
    setTimeout(() => this.suggestionsVisible.delete(index), 200);
  }

  selectSuggestion(index: number, visitor: VisitorSuggestion): void {
    const v = this.inlineVisitors[index];
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
    // Trigger blacklist check for the selected personId
    const subj = this.blacklistSubjects.get(index);
    if (subj) subj.next(visitor.personId);
  }

  hasBlacklistedVisitor(): boolean {
    for (const [, status] of this.blacklistMap) {
      if (status.blacklisted) return true;
    }
    return false;
  }

  isDuplicatePersonId(index: number): boolean {
    const val = this.inlineVisitors[index]?.personId?.trim();
    if (!val) return false;
    return this.inlineVisitors.some((v, i) => i !== index && v.personId?.trim() === val);
  }

  isDuplicatePhone(index: number): boolean {
    const val = this.inlineVisitors[index]?.phone?.trim();
    if (!val) return false;
    return this.inlineVisitors.some((v, i) => i !== index && v.phone?.trim() === val);
  }

  private clearBlacklistState(): void {
    this.blacklistMap.clear();
    this.blacklistSubs.forEach(s => s.unsubscribe());
    this.blacklistSubs = [];
    this.blacklistSubjects.clear();
    this.searchSubs = [];
    this.searchSubjects.clear();
  }

  private closeAllSuggestions(): void {
    this.suggestionsVisible.clear();
    this.adRequesterVisible = false;
    this.adEscortVisible.clear();
  }

  // ── AD People Search (Visit Requester & Escorts) ──

  onRequesterNameChange(value: string): void {
    if (!value || value.trim().length < 2) {
      this.adRequesterSuggestions = [];
      this.adRequesterNoResults = false;
      this.adRequesterLoading = false;
      this.adRequesterError = '';
      return;
    }
    if (!this.adRequesterSub) {
      this.adRequesterSub = this.adRequesterSubject.pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(q => {
          if (q.length < 2) { this.adRequesterSuggestions = []; return EMPTY; }
          this.adRequesterLoading = true;
          this.adRequesterError = '';
          return this.systemUserSearch.searchUsers(q).pipe(
            catchError(err => {
              this.adRequesterSuggestions = [];
              this.adRequesterNoResults = false;
              this.adRequesterError = this.getRequesterSearchErrorKey(err);
              this.adRequesterVisible = true;
              return EMPTY;
            }),
            finalize(() => { this.adRequesterLoading = false; }),
          );
        }),
      ).subscribe(results => {
        this.adRequesterSuggestions = results;
        this.adRequesterNoResults = results.length === 0;
        this.adRequesterVisible = true;
      });
    }
    this.adRequesterSubject.next(value.trim());
  }

  onRequesterFocus(field: 'first' | 'last'): void {
    this.adRequesterActiveField = field;
    if (this.adRequesterSuggestions.length || this.adRequesterNoResults || this.adRequesterError) {
      this.adRequesterVisible = true;
    }
  }

  onRequesterBlur(): void {
    setTimeout(() => this.adRequesterVisible = false, 200);
  }

  selectRequesterSuggestion(person: SystemUserSuggestion): void {
    this.visitRequester.firstName = person.firstName;
    this.visitRequester.lastName = person.lastName;
    this.visitRequester.email = person.email ?? '';
    this.visitRequester.phone = person.phone ?? '';
    this.adRequesterSuggestions = [];
    this.adRequesterVisible = false;
    this.adRequesterNoResults = false;
    this.adRequesterError = '';
    this.adRequesterActiveField = '';
  }

  onEscortNameChange(index: number, value: string): void {
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
        switchMap((q) => {
          if (q.length < 2) {
            this.adEscortSuggestions.delete(index);
            return EMPTY;
          }

          this.adEscortLoading.set(index, true);
          this.adEscortError.delete(index);

          return this.systemUserSearch.searchUsers(q).pipe(
            catchError(() => {
              this.adEscortSuggestions.delete(index);
              this.adEscortNoResults.delete(index);
              this.adEscortError.set(index, 'AD_SEARCH.ERROR_SEARCH_FAILED');
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

  onEscortNameFocus(index: number, field: 'first' | 'last'): void {
    this.adEscortActiveField.set(index, field);
    if (this.adEscortSuggestions.has(index) || this.adEscortNoResults.has(index) || this.adEscortError.has(index)) {
      this.adEscortVisible.set(index, true);
    }
  }

  onEscortNameBlur(index: number): void {
    setTimeout(() => this.adEscortVisible.delete(index), 200);
  }

  selectEscortSuggestion(index: number, person: SystemUserSuggestion): void {
    const e = this.inlineEscorts[index];
    if (!e) return;
    e.firstName = person.firstName;
    e.lastName = person.lastName;
    e.email = person.email ?? '';
    e.phone = person.phone ?? '';
    e.sector = person.sectorName ?? '';
    this.adEscortSuggestions.delete(index);
    this.adEscortVisible.delete(index);
    this.adEscortNoResults.delete(index);
    this.adEscortError.delete(index);
    this.adEscortActiveField.delete(index);
  }

  private getRequesterSearchErrorKey(_err: any): string {
    return 'AD_SEARCH.ERROR_SEARCH_FAILED';
  }

  private clearAdSearchState(): void {
    this.adRequesterSuggestions = [];
    this.adRequesterLoading = false;
    this.adRequesterVisible = false;
    this.adRequesterNoResults = false;
    this.adRequesterError = '';
    this.adRequesterActiveField = '';
    this.adRequesterSub?.unsubscribe();
    this.adRequesterSub = undefined;
    this.adRequesterSubject = new Subject<string>();
    this.adEscortSuggestions.clear();
    this.adEscortLoading.clear();
    this.adEscortVisible.clear();
    this.adEscortNoResults.clear();
    this.adEscortError.clear();
    this.adEscortActiveField.clear();
    this.adEscortSubs.forEach(s => s.unsubscribe());
    this.adEscortSubs = [];
    this.adEscortSubjects.clear();
  }

  ngOnDestroy(): void {
    this.clearBlacklistState();
    this.clearAdSearchState();
  }

  private loadEscortSectorOptions(): void {
    this.sectorsLookup.getActiveSectors().subscribe({
      next: (items) => { this.escortSectorOptions = items; },
      error: () => { this.escortSectorOptions = []; },
    });
  }
}
