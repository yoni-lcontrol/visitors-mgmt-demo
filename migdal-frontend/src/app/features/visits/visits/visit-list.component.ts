import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as XLSX from 'xlsx';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { VisitsApiService } from '../services/visits-api.service';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@core/services/confirm.service';
import { downloadBlob } from '@core/utils/download.util';
import { BuildingsApiService, Building as BuildingItem } from '../../settings/services/buildings-api.service';
import { Visit, VisitVisitor, VisitEscort, VisitorAccessLogEntry, VisitorAccessEventType } from '@core/models/entities.model';
import { PermissionService } from '@core/permissions/permission.service';
import { ApiService } from '@core/api/api.service';
import { DeviceStatusService } from '@core/services/device-status.service';
import { WorkstationSessionService } from '@core/services/workstation-session.service';
import { VisitorPrintService } from '../services/visitor-print.service';
import { TodaySummaryComponent } from './today-summary.component';
import { VisitDialogComponent } from './visit-dialog.component';
import { VisitVisitorsTableComponent } from './visit-visitors-table.component';
import { VisitEscortsTableComponent } from './visit-escorts-table.component';
import { VisitHistoryDialogComponent } from './visit-history-dialog.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-visit-list',
  standalone: true,
  imports: [
    DateFormatPipe,
    TranslateModule,
    HasPermissionDirective,
    NgClass,
    TableModule,
    InputTextModule,
    FormsModule,
    DialogModule,
    TodaySummaryComponent,
    VisitDialogComponent,
    VisitVisitorsTableComponent,
    VisitEscortsTableComponent,
    VisitHistoryDialogComponent,
  ],
  providers: [VisitorPrintService],
  template: `
    <div class="page-header">
      <h1>{{ 'VISITS.TITLE' | translate }}</h1>
      <div class="header-actions">
        <button class="btn btn-outline" *hasPermission="'visits.read'" (click)="exportData()">
          <i class="pi pi-file-excel"></i> {{ 'COMMON.EXPORT' | translate }}
        </button>
        <button class="btn btn-primary" *hasPermission="'visits.create'" (click)="openDialog()">
          <i class="pi pi-plus"></i> {{ 'VISITS.CREATE_VISIT' | translate }}
        </button>
      </div>
    </div>
    <app-today-summary></app-today-summary>

    <!-- Search & filters bar -->
    <div class="card filters-bar">
      <div class="search-group">
        <span class="search-input-wrap">
          <i class="pi pi-search"></i>
          <input pInputText type="text" [(ngModel)]="searchText" (input)="onSearchChange()" [placeholder]="'COMMON.SEARCH' | translate" />
        </span>
        <div class="search-field-dropdown">
          <button type="button" class="dropdown-trigger" (click)="searchDropdownOpen = !searchDropdownOpen">
            <i class="pi" [ngClass]="searchFieldIcon"></i>
            <span>{{ searchFieldLabel | translate }}</span>
            <i class="pi pi-chevron-down chevron" [class.open]="searchDropdownOpen"></i>
          </button>
          @if (searchDropdownOpen) {
            <div class="dropdown-backdrop" (click)="searchDropdownOpen = false"></div>
            <ul class="dropdown-menu">
              @for (opt of searchFieldOptions; track opt.value) {
                <li [class.active]="searchField === opt.value" (click)="onSearchFieldSelect(opt.value)">
                  <i class="pi" [ngClass]="opt.icon"></i>
                  <span>{{ opt.label | translate }}</span>
                </li>
              }
            </ul>
          }
        </div>
      </div>
      <div class="time-filter-group" role="group">
        <button type="button" class="time-filter-btn" [class.active]="activeTimeFilter === 'today'" (click)="onTimeFilterChange('today')">
          <i class="pi pi-calendar"></i> {{ 'VISITS.FILTER_TODAY' | translate }}
        </button>
        <button type="button" class="time-filter-btn" [class.active]="activeTimeFilter === 'future'" (click)="onTimeFilterChange('future')">
          <i class="pi pi-arrow-right"></i> {{ 'VISITS.FILTER_FUTURE' | translate }}
        </button>
        <button type="button" class="time-filter-btn" [class.active]="activeTimeFilter === 'history'" (click)="onTimeFilterChange('history')">
          <i class="pi pi-history"></i> {{ 'VISITS.FILTER_HISTORY' | translate }}
        </button>
        <button type="button" class="time-filter-btn" [class.active]="!activeTimeFilter" (click)="onTimeFilterChange(null)">
          <i class="pi pi-inbox"></i> {{ 'VISITS.FILTER_ARCHIVE' | translate }}
        </button>
      </div>
    </div>

    @if (loading) {
      <div class="loading-container"><i class="pi pi-spin pi-spinner"></i> {{ 'COMMON.LOADING' | translate }}</div>
    } @else if (items.length === 0) {
      <div class="empty-container"><i class="pi pi-inbox"></i> {{ 'COMMON.NO_DATA' | translate }}</div>
    } @else {
      <!-- Table -->
      <div class="table-container">
        <!-- Header row -->
        <div class="table-header">
          <div class="table-row header-row">
            <div class="th th-toggle"></div>
            <div class="th" [class.active]="sortField === 'title'" (click)="toggleSort('title')">
              {{ 'VISITS.VISIT_TITLE' | translate }}
              <i class="pi" [ngClass]="getSortIcon('title')"></i>
            </div>
            <div class="th">
              {{ 'VISITS.VISITORS' | translate }}
            </div>
            <div class="th" [class.active]="sortField === 'plannedStartTimeUtc'" (click)="toggleSort('plannedStartTimeUtc')">
              {{ 'VISITS.PLANNED_START' | translate }}
              <i class="pi" [ngClass]="getSortIcon('plannedStartTimeUtc')"></i>
            </div>
            <div class="th" [class.active]="sortField === 'plannedEndTimeUtc'" (click)="toggleSort('plannedEndTimeUtc')">
              {{ 'VISITS.PLANNED_END' | translate }}
              <i class="pi" [ngClass]="getSortIcon('plannedEndTimeUtc')"></i>
            </div>
            <div class="th">
              {{ 'VISITS.VISIT_REQUESTER' | translate }}
            </div>
            <div class="th" [class.active]="sortField === 'building'" (click)="toggleSort('building')">
              {{ 'BUILDINGS.BUILDING' | translate }}
              <i class="pi" [ngClass]="getSortIcon('building')"></i>
            </div>
            <div class="th th-actions">
              {{ 'COMMON.ACTIONS' | translate }}
            </div>
          </div>
        </div>
        <!-- Body rows -->
        <div class="table-body">
          @for (visit of items; track visit.id; let idx = $index; let isOdd = $odd) {
            <div class="table-row-group" [class.expanded]="expandedVisits[visit.id]">
              <div class="table-row data-row" [class.odd]="isOdd" (click)="togglePanel(visit.id)">
                <div class="td td-toggle">
                  <button type="button" class="toggle-btn">
                    <i class="pi" [class.pi-chevron-down]="expandedVisits[visit.id]" [class.pi-chevron-left]="!expandedVisits[visit.id]"></i>
                  </button>
                </div>
                <div class="td td-title">{{ visit.title }}</div>
                <div class="td td-visitors">
                  @if (visit.visitVisitors?.length) {
                    <div class="visitor-chips">
                      @for (vv of visit.visitVisitors!; track vv.id) {
                        <span class="visitor-chip" [class.visitor-chip-blocked]="isVisitorBlocked(vv)" [title]="vv.visitor?.fullName || ''">
                          {{ vv.visitor?.firstName }} {{ vv.visitor?.lastName }}
                        </span>
                      }
                    </div>
                  } @else {
                    <span class="no-visitors">-</span>
                  }
                </div>
                <div class="td td-dates">
                  <span dir="ltr">{{ visit.plannedStartTimeUtc | dateFormat }}</span>
                </div>
                <div class="td td-dates">
                  <span dir="ltr">{{ visit.plannedEndTimeUtc ? (visit.plannedEndTimeUtc | dateFormat) : '-' }}</span>
                </div>
                <div class="td td-requester">
                  @if (visit.visitRequester) {
                    <i class="pi pi-user"></i> {{ visit.visitRequester.firstName }} {{ visit.visitRequester.lastName }}
                  } @else {
                    -
                  }
                </div>
                <div class="td td-building">{{ visit.building?.name || '-' }}</div>
                <div class="td td-actions" (click)="$event.stopPropagation()">
                  <button class="row-action" (click)="goToDetail(visit.id)" [title]="'VISITS.VIEW_DETAIL' | translate"><i class="pi pi-external-link"></i></button>
                  <button class="row-action danger" [style.visibility]="canDeleteVisit(visit) ? 'visible' : 'hidden'" (click)="onDelete(visit)" [title]="'COMMON.DELETE' | translate"><i class="pi pi-trash"></i></button>
                  <button class="row-action" *hasPermission="'visits.update'" (click)="openDialog(visit)" [title]="'COMMON.EDIT' | translate"><i class="pi pi-pencil"></i></button>
                  <button class="row-action" (click)="showRequester(visit)" [title]="'VISITS.VISIT_REQUESTER' | translate"><i class="pi pi-id-card"></i></button>
                </div>
              </div>
              <!-- Expanded panel -->
              @if (expandedVisits[visit.id]) {
                <div class="expanded-panel">
                  <div class="info-card">
                    <div class="info-grid">
                      <div class="info-item">
                        <span class="info-label">{{ 'VISITS.PLANNED_START' | translate }}</span>
                        <span class="info-value" dir="ltr">{{ visit.plannedStartTimeUtc | dateFormat }}</span>
                      </div>
                      <div class="info-item">
                        <span class="info-label">{{ 'VISITS.PLANNED_END' | translate }}</span>
                        <span class="info-value" dir="ltr">{{ visit.plannedEndTimeUtc ? (visit.plannedEndTimeUtc | dateFormat) : '-' }}</span>
                      </div>
                      <div class="info-item">
                        <span class="info-label">{{ 'BUILDINGS.BUILDING' | translate }}</span>
                        <span class="info-value">{{ visit.building?.name || '-' }}</span>
                      </div>
                      @if (visit.visitRequester) {
                        <div class="info-item">
                          <span class="info-label">{{ 'VISITS.VISIT_REQUESTER' | translate }}</span>
                          <span class="info-value">{{ visit.visitRequester.firstName }} {{ visit.visitRequester.lastName }}</span>
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
                  <app-visit-visitors-table
                    [visitors]="visit.visitVisitors ?? []"
                    [codeMap]="getCodeMap(visit.id)"
                    [printingVisitorId]="printingVisitorId"
                    [printerConnected]="isPrinterConnected"
                    (registerEvent)="registerEvent(visit, $event.vv, $event.eventType)"
                    (editVisitor)="goToDetail(visit.id)"
                    (resendCode)="resendCheckInCode($event)"
                    (regenerateCode)="regenerateCheckInCode(visit.id, $event)"
                    (showHistory)="openHistoryDialog($event)"
                    (printCard)="printCard(visit, $event)"
                    (removeVisitor)="removeVisitor(visit, $event)"
                  />
                  @if (visit.visitEscorts?.length) {
                    <app-visit-escorts-table [escorts]="visit.visitEscorts!" />
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
      <!-- Pagination -->
      <div class="pagination-bar">
        <div class="pagination-buttons">
          <button class="btn-icon" [disabled]="first + rows >= totalRecords" (click)="goToPage((totalPages - 1) * rows)"><i class="pi pi-angle-double-right"></i></button>
          <button class="btn-icon" [disabled]="first + rows >= totalRecords" (click)="goToPage(first + rows)"><i class="pi pi-angle-right"></i></button>
          <span class="page-num">{{ currentPage }}</span>
          <button class="btn-icon" [disabled]="first === 0" (click)="goToPage(first - rows)"><i class="pi pi-angle-left"></i></button>
          <button class="btn-icon" [disabled]="first === 0" (click)="goToPage(0)"><i class="pi pi-angle-double-left"></i></button>
        </div>
        <div class="pagination-info">{{ first + 1 }}-{{ Math.min(first + rows, totalRecords) }} / {{ totalRecords }}</div>
        <select [value]="rows" (change)="onRowsChange($any($event.target).value)">
          <option [value]="10">10</option>
          <option [value]="20">20</option>
          <option [value]="50">50</option>
        </select>
      </div>
    }

    <app-visit-dialog #visitDialog
      [buildings]="buildings"
      (saved)="loadData()">
    </app-visit-dialog>

    <app-visit-history-dialog
      [(visible)]="showHistoryDialog"
      [items]="historyItems"
      [loading]="loadingHistory">
    </app-visit-history-dialog>

    <p-dialog [(visible)]="requesterDialogVisible"
              [header]="'VISITS.VISIT_REQUESTER' | translate"
              [modal]="true"
              [style]="{width: '420px'}"
              [draggable]="false">
      @if (selectedVisit?.visitRequester; as req) {
        <div class="requester-card">
          <div class="requester-avatar">
            <i class="pi pi-user"></i>
          </div>
          <div class="requester-name">{{ req.firstName }} {{ req.lastName }}</div>
        </div>
        <div class="detail-grid">
          <div class="detail-row">
            <span class="detail-label"><i class="pi pi-user"></i> {{ 'VISITS.FIRST_NAME' | translate }}</span>
            <span class="detail-value">{{ req.firstName }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label"><i class="pi pi-user"></i> {{ 'VISITS.LAST_NAME' | translate }}</span>
            <span class="detail-value">{{ req.lastName }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label"><i class="pi pi-phone"></i> {{ 'VISITS.PHONE' | translate }}</span>
            <span class="detail-value" dir="ltr">{{ req.phone || '-' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label"><i class="pi pi-envelope"></i> {{ 'VISITS.EMAIL' | translate }}</span>
            <span class="detail-value">{{ req.email || '-' }}</span>
          </div>
        </div>
      } @else {
        <div class="no-requester">
          <i class="pi pi-info-circle"></i>
          <span>{{ 'VISITS.NO_REQUESTER' | translate }}</span>
        </div>
      }
    </p-dialog>
  `,
  styles: [`
    :host { display: block; }
    .header-actions { display: flex; gap: 0.5rem; }

    /* Filters bar */
    .filters-bar {
      display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
      padding: 0.75rem 1rem; margin-bottom: 1rem;
    }
    .search-group {
      display: inline-flex; align-items: stretch;
      border: 1.5px solid var(--color-border, #e0dfe6);
      border-radius: 10px;
      background: var(--color-surface, #fff);
      transition: border-color 0.18s ease;
    }
    .search-group:focus-within {
      border-color: var(--color-primary, #6c63ff);
      box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.10);
    }
    .search-input-wrap {
      position: relative; display: flex; align-items: center;
    }
    .search-input-wrap i {
      position: absolute; inset-inline-end: 0.75rem;
      color: var(--color-text-muted, #9896ad); font-size: 0.9rem; pointer-events: none;
    }
    .search-input-wrap input {
      border: none; outline: none; background: transparent;
      padding: 0.5rem 2.25rem 0.5rem 0.75rem;
      font-size: 0.85rem; color: var(--color-text-primary, #23223a);
      min-width: 200px; height: 2.4rem; box-sizing: border-box;
    }
    .search-field-dropdown {
      position: relative; border-inline-start: 1.5px solid var(--color-border, #e0dfe6);
    }
    .dropdown-backdrop {
      position: fixed; inset: 0; z-index: 99; background: transparent;
    }
    .dropdown-trigger {
      display: flex; align-items: center; gap: 0.4rem;
      border: none; background: var(--color-surface-alt, #f7f7fa);
      padding: 0 0.85rem; font-size: 0.82rem; font-weight: 500;
      color: var(--color-text-secondary, #64637a);
      cursor: pointer; outline: none;
      height: 2.4rem; box-sizing: border-box;
      white-space: nowrap; transition: all 0.15s ease;
    }
    .dropdown-trigger:hover {
      background: var(--color-surface-hover, #efeff4);
      color: var(--color-text-primary, #23223a);
    }
    .dropdown-trigger .chevron {
      font-size: 0.65rem; margin-inline-start: 0.15rem;
      transition: transform 0.2s ease;
    }
    .dropdown-trigger .chevron.open { transform: rotate(180deg); }
    .dropdown-trigger i:first-child { font-size: 0.8rem; opacity: 0.7; }
    .dropdown-menu {
      position: absolute; top: calc(100% + 4px); inset-inline-end: 0;
      min-width: 180px; padding: 0.35rem 0;
      background: var(--color-surface, #fff);
      border: 1.5px solid var(--color-border, #e0dfe6);
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.10);
      z-index: 100; list-style: none; margin: 0;
      animation: dropdownFade 0.15s ease;
    }
    @keyframes dropdownFade {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .dropdown-menu li {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.85rem; font-size: 0.83rem;
      color: var(--color-text-secondary, #64637a);
      cursor: pointer; transition: all 0.12s ease; white-space: nowrap;
    }
    .dropdown-menu li:hover {
      background: rgba(108, 99, 255, 0.06);
      color: var(--color-text-primary, #23223a);
    }
    .dropdown-menu li.active {
      color: var(--color-primary, #6c63ff); font-weight: 600;
      background: rgba(108, 99, 255, 0.08);
    }
    .dropdown-menu li i { font-size: 0.82rem; width: 1rem; text-align: center; }

    /* Time filter */
    .time-filter-group {
      display: inline-flex; border-radius: 8px; overflow: hidden;
      border: 1.5px solid var(--color-border, #e0dfe6); background: var(--color-surface, #fff);
    }
    .time-filter-btn {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.4rem 0.85rem; font-size: 0.82rem; font-weight: 500;
      border: none; background: transparent; color: var(--color-text-muted, #9896ad);
      cursor: pointer; transition: all 0.18s ease; white-space: nowrap;
      border-inline-end: 1px solid var(--color-border, #e0dfe6);
    }
    .time-filter-btn:last-child { border-inline-end: none; }
    .time-filter-btn:hover { background: rgba(108, 99, 255, 0.06); color: var(--color-text-primary, #23223a); }
    .time-filter-btn.active { background: var(--color-primary, #6c63ff); color: #fff; }
    .time-filter-btn i { font-size: 0.85rem; }

    /* Loading / empty */
    .loading-container, .empty-container {
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      padding: 3rem; color: var(--color-text-muted); font-size: 0.95rem;
    }
    .loading-container i { font-size: 1.2rem; }
    .empty-container i { font-size: 1.5rem; }

    /* ========== TABLE ========== */
    .table-container {
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e0dfe6);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    /* Shared grid for header + data rows */
    .table-row {
      display: grid;
      grid-template-columns: 40px 1.2fr 1.5fr 1fr 1fr 1fr 0.8fr 140px;
      align-items: center;
      gap: 0.5rem;
      padding: 0 1rem;
    }

    /* Header */
    .table-header {
      background: linear-gradient(180deg, #f8f7fc 0%, #f3f2f9 100%);
      border-bottom: 2px solid var(--color-border, #e0dfe6);
    }
    .header-row {
      min-height: 44px;
    }
    .th {
      display: flex; align-items: center; gap: 0.35rem;
      font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-secondary, #5c5a78);
      user-select: none; white-space: nowrap;
      padding: 0.65rem 0;
      min-width: 0;
    }
    .th i { font-size: 0.6rem; transition: transform 0.15s; }
    .th:has(i) { cursor: pointer; }
    .th:has(i):hover, .th.active {
      color: var(--color-primary, #6c63ff);
    }
    .th-actions {
      justify-content: center;
    }

    /* Body */
    .table-body {}
    .table-row-group {
      border-bottom: 1px solid var(--color-border-light, #eeedfa);
    }
    .table-row-group:last-child { border-bottom: none; }
    .table-row-group.expanded {
      background: rgba(108, 99, 255, 0.02);
    }

    .data-row {
      min-height: 52px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .data-row:hover {
      background: rgba(108, 99, 255, 0.04);
    }
    .data-row.odd {
      background: rgba(108, 99, 255, 0.015);
    }
    .data-row.odd:hover {
      background: rgba(108, 99, 255, 0.05);
    }

    /* Cells */
    .td {
      font-size: 0.85rem;
      color: var(--color-text-secondary, #5c5a78);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      padding: 0.6rem 0;
      min-width: 0;
    }
    .td-title {
      font-weight: 600; font-size: 0.92rem;
      color: var(--color-text-primary, #23223a);
    }
    .td-visitors {
      overflow: visible;
    }
    .visitor-chips {
      display: flex; align-items: center; gap: 0.3rem;
      flex-wrap: wrap;
    }
    .visitor-chip {
      display: inline-flex; align-items: center;
      padding: 0.2rem 0.55rem;
      background: rgba(108, 99, 255, 0.06);
      border: 1px solid rgba(108, 99, 255, 0.12);
      border-radius: 20px;
      font-size: 0.78rem; font-weight: 500; color: var(--color-text-secondary, #5c5a78);
      white-space: nowrap; max-width: 160px;
      overflow: hidden; text-overflow: ellipsis;
      transition: all 0.15s;
      flex-shrink: 0;
    }
    .visitor-chip:hover {
      background: rgba(108, 99, 255, 0.10);
      border-color: rgba(108, 99, 255, 0.22);
    }
    .visitor-chip-blocked {
      background: rgba(239, 68, 68, 0.06);
      border-color: rgba(239, 68, 68, 0.18);
      color: #dc2626;
    }
    .visitor-chip-blocked:hover {
      background: rgba(239, 68, 68, 0.12);
      border-color: rgba(239, 68, 68, 0.28);
    }
    .overflow-chip {
      padding: 0.2rem 0.5rem;
      background: rgba(108, 99, 255, 0.10);
      color: var(--color-primary, #6c63ff);
      font-weight: 700; font-size: 0.72rem;
      cursor: default;
    }
    .no-visitors { color: var(--color-text-muted, #b0afc0); }
    .td-dates {
      display: flex; align-items: center; gap: 0.3rem;
    }
    .date-sep { color: var(--color-text-muted, #b0afc0); font-size: 0.75rem; }
    .td-requester {
      display: flex; align-items: center; gap: 0.3rem;
    }
    .td-requester i { font-size: 0.78rem; color: var(--color-text-muted); }
    .td-building { color: var(--color-text-muted, #9896ad); }
    .td-actions {
      display: flex; gap: 0.15rem; align-items: center;
      justify-content: center;
      overflow: visible;
    }

    /* Toggle button */
    .toggle-btn {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border: none; background: transparent;
      color: var(--color-text-muted); cursor: pointer; border-radius: 6px;
      transition: all 0.15s; flex-shrink: 0;
    }
    .toggle-btn:hover { background: rgba(108, 99, 255, 0.08); color: var(--color-primary); }

    /* Row action buttons */
    .row-action {
      display: inline-flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border: none; background: transparent;
      border-radius: 6px; cursor: pointer;
      color: var(--color-text-secondary, #64637a);
      font-size: 0.85rem; transition: all 0.15s; flex-shrink: 0;
    }
    .row-action i { font-size: 0.82rem; line-height: 1; }
    .row-action:hover {
      background: rgba(108, 99, 255, 0.08);
      color: var(--color-primary, #6c63ff);
    }
    .row-action.danger:hover {
      background: rgba(239, 68, 68, 0.08);
      color: #dc2626;
    }

    /* Expanded panel */
    .expanded-panel {
      padding: 0 1.25rem 1.25rem;
      border-top: 1px solid var(--color-border-light, #eeedfa);
      animation: panelSlide 0.2s ease;
    }
    @keyframes panelSlide {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Info card */
    .info-card {
      background: var(--color-surface-alt, #faf9fe);
      border: 1px solid var(--color-border-light, #eeedfa);
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 1rem;
      margin-top: 0.75rem;
    }
    .info-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.75rem 1.5rem;
    }
    .info-item { display: flex; flex-direction: column; gap: 0.2rem; }
    .info-label { font-size: 0.75rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .info-value { font-size: 0.9rem; font-weight: 500; color: var(--color-text-primary, #23223a); }

    /* Summary bar */
    .summary-bar {
      display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;
      margin-top: 0.75rem; padding-top: 0.75rem;
      border-top: 1px solid var(--color-border-light, #eeedfa);
    }
    .summary-item {
      display: inline-flex; align-items: center; gap: 0.3rem;
      padding: 0.3rem 0.7rem; border-radius: 999px;
      font-size: 0.78rem; font-weight: 600; white-space: nowrap;
      border: 1px solid transparent;
    }
    .summary-item i { font-size: 0.72rem; }
    .summary-item.total { background: rgba(108, 99, 255, 0.10); color: #6c63ff; border-color: rgba(108, 99, 255, 0.18); }
    .summary-item.pending { background: rgba(245, 158, 11, 0.10); color: #b45309; border-color: rgba(245, 158, 11, 0.20); }
    .summary-item.arrived { background: rgba(59, 130, 246, 0.10); color: #1d4ed8; border-color: rgba(59, 130, 246, 0.20); }
    .summary-item.checked-in { background: rgba(34, 197, 94, 0.10); color: #15803d; border-color: rgba(34, 197, 94, 0.20); }
    .summary-item.checked-out { background: rgba(100, 116, 139, 0.10); color: #475569; border-color: rgba(100, 116, 139, 0.20); }

    /* Pagination */
    .pagination-bar {
      display: flex; align-items: center; justify-content: flex-end; gap: 1rem;
      padding: 0.75rem 1rem; margin-top: 0.5rem;
    }
    .pagination-bar select {
      padding: 0.3rem 0.5rem; border-radius: 6px;
      border: 1px solid var(--color-border); font-size: 0.82rem;
    }
    .pagination-info { font-size: 0.82rem; color: var(--color-text-secondary); }
    .pagination-buttons { display: flex; gap: 0.15rem; align-items: center; }
    .page-num {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 28px; height: 28px; border-radius: 6px;
      background: var(--color-primary, #020140); color: #ffffff;
      font-weight: 700; font-size: 0.82rem;
    }

    /* Requester dialog */
    .requester-card {
      display: flex; flex-direction: column; align-items: center;
      padding: 0.5rem 0 1.25rem; gap: 0.6rem;
    }
    .requester-avatar {
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #6c63ff 0%, #48c6ef 100%);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 1.5rem;
    }
    .requester-name { font-size: 1.1rem; font-weight: 600; color: var(--color-text-primary); }
    .detail-grid { display: flex; flex-direction: column; gap: 0; }
    .detail-row {
      display: flex; gap: 1rem; align-items: center;
      padding: 0.65rem 0.75rem;
      border-bottom: 1px solid var(--color-border-light, #f0eff5);
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label {
      display: flex; align-items: center; gap: 0.45rem;
      font-weight: 600; min-width: 120px;
      color: var(--color-text-secondary); font-size: 0.84rem;
    }
    .detail-label i { font-size: 0.9rem; color: var(--color-primary, #6c63ff); }
    .detail-value { font-size: 0.9rem; color: var(--color-text-primary); }
    .no-requester {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 1.5rem; justify-content: center;
      color: var(--color-text-muted); font-size: 0.9rem;
    }
  `],
})
export class VisitListComponent implements OnInit, OnDestroy {
  @ViewChild('visitDialog') visitDialog!: VisitDialogComponent;

  private visitsApi = inject(VisitsApiService);
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private buildingsApi = inject(BuildingsApiService);
  private confirmService = inject(ConfirmService);
  private permissionService = inject(PermissionService);
  private translateService = inject(TranslateService);
  private printService = inject(VisitorPrintService);
  private deviceStatus = inject(DeviceStatusService);
  private workstationSession = inject(WorkstationSessionService);

  items: Visit[] = [];
  totalRecords = 0;
  rows = 20;
  first = 0;
  sortField = 'plannedStartTimeUtc';
  sortOrder = -1;
  loading = false;
  activeTimeFilter: 'today' | 'future' | 'history' | null = 'today';
  private lastLazyEvent: any = { first: 0, rows: 20, sortField: 'plannedStartTimeUtc', sortOrder: -1, filters: {} };

  buildings: BuildingItem[] = [];
  requesterDialogVisible = false;
  selectedVisit: Visit | null = null;

  // Accordion state
  expandedVisits: Record<string, boolean> = {};
  searchText = '';
  searchField: 'all' | 'title' | 'visitor' | 'escort' | 'requester' | 'building' | 'personId' = 'all';
  searchDropdownOpen = false;
  searchFieldOptions: { value: string; label: string; icon: string }[] = [
    { value: 'all', label: 'VISITS.SEARCH_ALL', icon: 'pi-list' },
    { value: 'title', label: 'VISITS.VISIT_TITLE', icon: 'pi-tag' },
    { value: 'visitor', label: 'VISITS.VISITOR', icon: 'pi-user' },
    { value: 'personId', label: 'VISITS.PERSON_ID', icon: 'pi-id-card' },
    { value: 'escort', label: 'VISITS.ESCORT', icon: 'pi-users' },
    { value: 'requester', label: 'VISITS.VISIT_REQUESTER', icon: 'pi-user-edit' },
    { value: 'building', label: 'BUILDINGS.BUILDING', icon: 'pi-building' },
  ];
  Math = Math;

  // Check-in codes per visit
  codeMaps = new Map<string, Map<string, string>>();

  // History dialog
  showHistoryDialog = false;
  historyItems: VisitorAccessLogEntry[] = [];
  loadingHistory = false;

  // Printing
  printingVisitorId: string | null = null;
  isPrinterConnected = false;
  private printSub: Subscription | null = null;
  private deviceSub: Subscription | null = null;

  ngOnInit(): void {
    this.loadData();
    this.loadBuildings();
    this.initPrintListeners();
  }

  ngOnDestroy(): void {
    this.printSub?.unsubscribe();
    this.deviceSub?.unsubscribe();
  }

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

  loadBuildings(): void {
    this.buildingsApi.getAll({ limit: 100, active: 1 }).subscribe({
      next: (r) => { this.buildings = r.items; },
      error: () => { },
    });
  }

  loadData(event: any = this.lastLazyEvent): void {
    this.loading = true;
    this.lastLazyEvent = event;

    const page = Math.floor(this.first / this.rows) + 1;
    const params: Record<string, string | number> = {
      page,
      limit: this.rows,
      sortBy: this.sortField,
      sortOrder: this.sortOrder === 1 ? 'ASC' : 'DESC',
    };
    if (this.searchText) {
      params['search'] = this.searchText;
      if (this.searchField !== 'all') params['searchField'] = this.searchField;
    }
    if (this.activeTimeFilter) params['timeFilter'] = this.activeTimeFilter;

    this.visitsApi.getVisits(params).subscribe({
      next: (r) => {
        this.items = r.items;
        this.totalRecords = r.total;
        this.loading = false;
        this.expandedVisits = {};
        this.loadAllCheckInCodes();
      },
      error: () => { this.loading = false; },
    });
  }

  get currentPage(): number {
    return Math.floor(this.first / this.rows) + 1;
  }

  get totalPages(): number {
    return Math.ceil(this.totalRecords / this.rows);
  }

  goToPage(newFirst: number): void {
    this.first = Math.max(0, Math.min(newFirst, (this.totalPages - 1) * this.rows));
    this.loadData();
  }

  onRowsChange(value: string): void {
    this.rows = parseInt(value, 10);
    this.first = 0;
    this.loadData();
  }

  onSearchChange(): void {
    this.first = 0;
    this.loadData();
  }

  get searchFieldLabel(): string {
    return this.searchFieldOptions.find(o => o.value === this.searchField)?.label ?? 'VISITS.SEARCH_ALL';
  }

  get searchFieldIcon(): string {
    return this.searchFieldOptions.find(o => o.value === this.searchField)?.icon ?? 'pi-list';
  }

  onSearchFieldSelect(value: string): void {
    this.searchField = value as any;
    this.searchDropdownOpen = false;
    if (this.searchText) {
      this.first = 0;
      this.loadData();
    }
  }

  toggleSort(field: string): void {
    if (this.sortField === field) {
      this.sortOrder = this.sortOrder === 1 ? -1 : 1;
    } else {
      this.sortField = field;
      this.sortOrder = 1;
    }
    this.first = 0;
    this.loadData();
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) return 'pi-sort-alt';
    return this.sortOrder === 1 ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down';
  }

  togglePanel(visitId: string): void {
    this.expandedVisits[visitId] = !this.expandedVisits[visitId];
  }

  getInitials(firstName?: string, lastName?: string): string {
    return ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?';
  }

  getVisitorNames(visitors: VisitVisitor[]): string {
    return visitors
      .map(vv => `${vv.visitor?.firstName ?? ''} ${vv.visitor?.lastName ?? ''}`.trim())
      .filter(n => n)
      .join(', ');
  }

  private loadAllCheckInCodes(): void {
    this.codeMaps.clear();
    for (const visit of this.items) {
      this.visitsApi.getCheckInCodes(visit.id).subscribe({
        next: (codes) => {
          const map = new Map<string, string>();
          for (const c of codes) {
            if (c.isActive && !c.usedAtUtc) {
              map.set(c.visitVisitorId, c.code);
            }
          }
          this.codeMaps.set(visit.id, map);
        },
      });
    }
  }

  getCodeMap(visitId: string): Map<string, string> {
    return this.codeMaps.get(visitId) ?? new Map();
  }

  onTimeFilterChange(filter: 'today' | 'future' | 'history' | null): void {
    this.activeTimeFilter = filter;
    this.first = 0;
    this.loadData();
  }

  goToDetail(visitId: string): void {
    if (!this.permissionService.hasPermission('visits.read')) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    this.router.navigate(['/visits', visitId]);
  }

  openDialog(visit?: Visit): void {
    const canOpen = visit
      ? this.permissionService.hasPermission('visits.update')
      : this.permissionService.hasPermission('visits.create');
    if (!canOpen) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    this.visitDialog.open(visit);
  }

  showRequester(visit: Visit): void {
    this.selectedVisit = visit;
    this.requesterDialogVisible = true;
  }

  async onDelete(visit: Visit): Promise<void> {
    if (!this.canDeleteVisit(visit)) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    if (!await this.confirmService.confirm('VISITS.DELETE_CONFIRM')) return;
    this.visitsApi.deleteVisit(visit.id).subscribe({
      next: () => { this.notify.success('COMMON.SUCCESS'); this.loadData(); },
      error: (err) => this.notify.error(err),
    });
  }

  exportData(): void {
    if (!this.permissionService.hasPermission('visits.read')) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    const event = this.lastLazyEvent ?? {};
    const params: Record<string, string | number> = {
      sortBy: event.sortField || 'plannedStartTimeUtc',
      sortOrder: (event.sortOrder || -1) === 1 ? 'ASC' : 'DESC',
      filters: JSON.stringify(event.filters ?? {}),
    };
    const global = event.filters?.global?.value;
    if (global) params['search'] = global;
    if (this.activeTimeFilter) params['timeFilter'] = this.activeTimeFilter;

    this.visitsApi.exportVisits(params).subscribe({
      next: (blob) => {
        downloadBlob(blob, 'visits.xlsx');
      },
      error: (err) => this.notify.error(err),
    });
  }

  downloadImportTemplate(): void {
    const headers = ['שם פרטי', 'שם משפחה', 'מספר זהות', 'טלפון', 'אימייל', 'מספר רכב', 'סוג רכב'];
    const sample = [
      ['ישראל', 'ישראלי', '123456789', '0501234567', 'israel@example.com', '12-345-67', 'private'],
      ['דנה', 'כהן', '987654321', '0529876543', 'dana@example.com', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 14 }];
    // Add dropdown validation for vehicle type column (G2:G1000)
    ws['!dataValidations'] = [{
      type: 'list',
      sqref: 'G2:G1000',
      formulas: ['private,company,taxi,motorcycle,truck,other'],
    }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visitors');
    const buf: ArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'visit-import-template.xlsx');
  }

  canDeleteVisit(visit: Visit): boolean {
    if (!this.permissionService.hasPermission('visits.delete')) {
      return false;
    }

    if (!this.permissionService.hasPermission('visits.delete.own-only')) {
      return true;
    }

    const currentUserId = this.permissionService.getCurrentUserId();
    if (!currentUserId) {
      return false;
    }

    return visit.createdByUserId === currentUserId;
  }

  isVisitorBlocked(vv: VisitVisitor): boolean {
    return vv.blacklistOverride?.status === 'pending' || vv.blacklistOverride?.status === 'denied';
  }

  // ── Visitor action handlers ──

  registerEvent(visit: Visit, vv: VisitVisitor, eventType: VisitorAccessEventType): void {
    if (!this.permissionService.hasPermission('visits.update')) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    this.api.post('/visitor-access-logs', {
      visitVisitorId: vv.id,
      eventType,
    }).subscribe({
      next: () => {
        this.notify.success('COMMON.SUCCESS');
        this.loadData();
      },
      error: (err) => this.notify.error(err),
    });
  }

  resendCheckInCode(vv: VisitVisitor): void {
    if (!this.permissionService.hasPermission('visits.check-in-code.send')) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    this.visitsApi.resendCheckInCode(vv.id).subscribe({
      next: (result) => {
        this.notify.success(result.sent ? 'VISITS.CODE_RESENT' : 'VISITS.CODE_RESEND_FAILED');
      },
      error: (err) => this.notify.error(err),
    });
  }

  regenerateCheckInCode(visitId: string, vv: VisitVisitor): void {
    if (!this.permissionService.hasPermission('visits.check-in-code.regenerate')) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    this.visitsApi.regenerateCheckInCode(vv.id).subscribe({
      next: (newCode) => {
        const map = this.codeMaps.get(visitId) ?? new Map<string, string>();
        map.set(vv.id, newCode.code);
        this.codeMaps.set(visitId, map);
        this.notify.success('VISITS.CODE_REGENERATED');
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

  printCard(visit: Visit, vv: VisitVisitor): void {
    if (this.printingVisitorId || !vv.visitorId) return;
    if (!this.workstationSession.currentState.bound || !this.workstationSession.isPrinterConnected()) return;
    this.printingVisitorId = vv.id;
    this.printService.requestPrint({
      visitId: visit.id,
      visitorId: vv.visitorId,
    });
  }

  async removeVisitor(visit: Visit, vv: VisitVisitor): Promise<void> {
    if (!this.permissionService.hasPermission('visits.delete')) {
      this.notify.error('COMMON.ACTION_NOT_ALLOWED');
      return;
    }
    if (!await this.confirmService.confirm('COMMON.CONFIRM_REMOVE')) return;
    this.visitsApi.removeVisitor(visit.id, vv.id).subscribe({
      next: () => { this.notify.success('COMMON.SUCCESS'); this.loadData(); },
      error: (err) => this.notify.error(err),
    });
  }
}