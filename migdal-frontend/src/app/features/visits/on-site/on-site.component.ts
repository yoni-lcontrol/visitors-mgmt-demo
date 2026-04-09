import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CalendarModule } from 'primeng/calendar';
import { VisitsApiService, OnSiteVisitor, OnSiteResponse } from '../services/visits-api.service';
import { UserWebSocketService } from '@core/websocket/user-websocket.service';
import { WsEvent } from '@core/websocket/ws-events.enum';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { PermissionService } from '@core/permissions/permission.service';

@Component({
  selector: 'app-on-site',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, HasPermissionDirective, CalendarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="on-site-page">
      <!-- Header -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-text">
            <h1>{{ 'ON_SITE.TITLE' | translate }}</h1>
            <p class="header-description">{{ 'ON_SITE.DESCRIPTION' | translate }}</p>
          </div>
          <div class="header-date">
            <p-calendar
              [(ngModel)]="selectedDate"
              dateFormat="dd/mm/yy"
              [showIcon]="true"
              [showClear]="true"
              [readonlyInput]="true"
              appendTo="body"
              (onSelect)="onDateSelect()"
              (onClear)="onDateSelect()"
            ></p-calendar>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card total">
          <div class="summary-icon"><i class="pi pi-users"></i></div>
          <div class="summary-info">
            <span class="summary-value">{{ summary.onSite }}</span>
            <span class="summary-label">{{ 'ON_SITE.ON_SITE_NOW' | translate }}</span>
          </div>
        </div>
        <div class="summary-card arrived">
          <div class="summary-icon"><i class="pi pi-sign-in"></i></div>
          <div class="summary-info">
            <span class="summary-value">{{ summary.arrived }}</span>
            <span class="summary-label">{{ 'ON_SITE.ARRIVED' | translate }}</span>
          </div>
        </div>
        <div class="summary-card checked-in">
          <div class="summary-icon"><i class="pi pi-check-circle"></i></div>
          <div class="summary-info">
            <span class="summary-value">{{ summary.checkedIn }}</span>
            <span class="summary-label">{{ 'ON_SITE.CHECKED_IN' | translate }}</span>
          </div>
        </div>
        <div class="summary-card blacklisted" *ngIf="summary.blacklisted > 0">
          <div class="summary-icon"><i class="pi pi-exclamation-triangle"></i></div>
          <div class="summary-info">
            <span class="summary-value">{{ summary.blacklisted }}</span>
            <span class="summary-label">{{ 'ON_SITE.BLACKLISTED_ON_SITE' | translate }}</span>
          </div>
        </div>
      </div>

      <!-- Toolbar: Search + Filters -->
      <div class="toolbar">
        <div class="search-box">
          <i class="pi pi-search search-icon"></i>
          <input
            type="text"
            [placeholder]="'ON_SITE.SEARCH_PLACEHOLDER' | translate"
            [(ngModel)]="searchTerm"
            (ngModelChange)="onSearchChange($event)"
            class="search-input"
          />
          <button *ngIf="searchTerm" class="search-clear" (click)="clearSearch()">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="filter-group">
          <select [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()" class="filter-select">
            <option value="">{{ 'ON_SITE.ALL_STATUSES' | translate }}</option>
            <option value="arrived">{{ 'ON_SITE.ARRIVED' | translate }}</option>
            <option value="checked-in">{{ 'ON_SITE.CHECKED_IN' | translate }}</option>
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn-refresh" (click)="loadData()" [title]="'ON_SITE.REFRESH' | translate">
            <i class="pi pi-refresh" [class.spinning]="loading"></i>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading && !items.length" class="state-container loading-state">
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
        <p>{{ 'ON_SITE.LOADING' | translate }}</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error" class="state-container error-state">
        <i class="pi pi-exclamation-circle"></i>
        <p>{{ 'ON_SITE.ERROR' | translate }}</p>
        <button class="btn-retry" (click)="loadData()">{{ 'ON_SITE.RETRY' | translate }}</button>
      </div>

      <!-- Empty State -->
      <div *ngIf="!loading && !error && items.length === 0" class="state-container empty-state">
        <i class="pi pi-users"></i>
        <h3>{{ 'ON_SITE.EMPTY_TITLE' | translate }}</h3>
        <p>{{ 'ON_SITE.EMPTY_HINT' | translate }}</p>
      </div>

      <!-- Visitor Cards Grid -->
      <div *ngIf="items.length > 0" class="cards-grid">
        <div
          *ngFor="let visitor of items; trackBy: trackByVisitVisitorId"
          class="visitor-card"
          [class.blacklisted]="visitor.isBlacklisted"
        >
          <!-- Blacklist Banner -->
          <div *ngIf="visitor.isBlacklisted" class="blacklist-banner">
            <i class="pi pi-exclamation-triangle"></i>
            <span>{{ 'ON_SITE.BLACKLISTED' | translate }}</span>
            <span *ngIf="visitor.blacklistReason" class="bl-reason">— {{ visitor.blacklistReason }}</span>
          </div>

          <!-- Card Header -->
          <div class="card-header">
            <div class="visitor-name-row">
              <div class="visitor-avatar" [class.bl-avatar]="visitor.isBlacklisted">
                {{ getInitials(visitor) }}
              </div>
              <div class="visitor-identity">
                <h3 class="visitor-name">{{ visitor.visitorFullName }}</h3>
              </div>
            </div>
            <div class="status-badge" [class]="getStatusClass(visitor.currentStatus)">
              {{ getStatusLabel(visitor.currentStatus) }}
            </div>
          </div>

          <!-- Card Body -->
          <div class="card-body">
            <div class="info-row" *ngIf="visitor.visitTitle">
              <i class="pi pi-calendar"></i>
              <span class="info-label">{{ visitor.visitTitle }}</span>
            </div>
            <div class="info-row" *ngIf="visitor.plannedStartTimeUtc">
              <i class="pi pi-clock"></i>
              <span>{{ formatTime(visitor.plannedStartTimeUtc) }}<span *ngIf="visitor.plannedEndTimeUtc"> — {{ formatTime(visitor.plannedEndTimeUtc) }}</span></span>
            </div>
            <div class="info-row" *ngIf="getHostName(visitor)">
              <i class="pi pi-user"></i>
              <span>{{ getHostName(visitor) }}</span>
            </div>
            <div class="info-row" *ngIf="visitor.visitorPhone">
              <i class="pi pi-phone"></i>
              <span>{{ visitor.visitorPhone }}</span>
            </div>
            <div class="info-row" *ngIf="visitor.visitorPersonId">
              <i class="pi pi-id-card"></i>
              <span>{{ visitor.visitorPersonId }}</span>
            </div>
            <div class="info-row" *ngIf="visitor.siteId">
              <i class="pi pi-building"></i>
              <span>{{ visitor.siteId }}</span>
            </div>

            <!-- Timestamps -->
            <div class="timestamps">
              <span *ngIf="visitor.arrivedAtUtc" class="timestamp arrived-ts">
                <i class="pi pi-sign-in"></i> {{ formatTime(visitor.arrivedAtUtc) }}
              </span>
              <span *ngIf="visitor.checkedInAtUtc" class="timestamp checkedin-ts">
                <i class="pi pi-check-circle"></i> {{ formatTime(visitor.checkedInAtUtc) }}
              </span>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="card-actions">
            <button
              *hasPermission="'visits.update'"
              class="action-btn check-in-btn"
              (click)="onCheckIn(visitor)"
              [disabled]="visitor.currentStatus === 2"
              [title]="'ON_SITE.CHECK_IN' | translate"
            >
              <i class="pi pi-check"></i>
              <span>{{ 'ON_SITE.CHECK_IN' | translate }}</span>
            </button>
            <button
              *hasPermission="'visits.update'"
              class="action-btn check-out-btn"
              (click)="onCheckOut(visitor)"
              [title]="'ON_SITE.CHECK_OUT' | translate"
            >
              <i class="pi pi-sign-out"></i>
              <span>{{ 'ON_SITE.CHECK_OUT' | translate }}</span>
            </button>
            <button
              class="action-btn view-btn"
              (click)="viewVisitDetails(visitor)"
              [title]="'ON_SITE.VIEW_VISIT' | translate"
            >
              <i class="pi pi-eye"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div *ngIf="totalPages > 1" class="pagination">
        <button class="page-btn" [disabled]="currentPage === 1" (click)="goToPage(currentPage - 1)">
          <i class="pi pi-chevron-left"></i>
        </button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button class="page-btn" [disabled]="currentPage === totalPages" (click)="goToPage(currentPage + 1)">
          <i class="pi pi-chevron-right"></i>
        </button>
      </div>

      <!-- Live indicator -->
      <div class="live-indicator" *ngIf="!loading">
        <span class="live-dot"></span>
        <span>{{ 'ON_SITE.LIVE' | translate }}</span>
      </div>
    </div>
  `,
  styles: [`
    .on-site-page {
      padding: 1.5rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Header */
    .page-header {
      margin-bottom: 1.5rem;
    }
    .header-content {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      width: 100%;
    }
    .header-text h1 {
      margin: 0 0 0.25rem;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--color-text, #1e293b);
    }
    .header-text {
      flex: 1 1 0%;
      min-width: 0;
    }
    .header-description {
      margin: 0;
      color: var(--color-text-secondary, #64748b);
      font-size: 0.9rem;
    }
    .header-date {
      margin-inline-start: auto;
      flex: 0 0 auto;
    }
    :host ::ng-deep .header-date .p-calendar {
      min-width: 180px;
    }
    :host ::ng-deep .header-date .p-calendar .p-inputtext {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--color-border, #e2e8f0);
      border-start-start-radius: var(--radius-sm, 6px);
      border-end-start-radius: var(--radius-sm, 6px);
      border-start-end-radius: 0;
      border-end-end-radius: 0;
      font-size: 0.9rem;
      background: #fff;
      color: var(--color-text, #1e293b);
      width: 100%;
      cursor: pointer;
    }
    :host ::ng-deep .header-date .p-calendar .p-inputtext:focus {
      border-color: var(--color-accent, #6c63ff);
      box-shadow: 0 0 0 2px rgba(108,99,255,0.15);
    }
    :host ::ng-deep .header-date .p-calendar .p-datepicker-trigger {
      background: transparent;
      border: 1px solid var(--color-border, #e2e8f0);
      border-inline-start: none;
      color: var(--color-text-secondary, #64748b);
      border-start-start-radius: 0;
      border-end-start-radius: 0;
      border-start-end-radius: var(--radius-sm, 6px);
      border-end-end-radius: var(--radius-sm, 6px);
    }
    :host ::ng-deep .header-date .p-calendar .p-datepicker-trigger:hover {
      background: #f8fafc;
      color: var(--color-accent, #6c63ff);
    }

    /* Summary Cards */
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .summary-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-radius: var(--radius-md, 8px);
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      border-inline-start: 4px solid transparent;
    }
    .summary-card.total { border-inline-start-color: var(--color-accent, #6c63ff); }
    .summary-card.arrived { border-inline-start-color: #1d4ed8; }
    .summary-card.checked-in { border-inline-start-color: #15803d; }
    .summary-card.blacklisted { border-inline-start-color: #dc2626; }

    .summary-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      flex-shrink: 0;
    }
    .total .summary-icon { background: rgba(108,99,255,0.1); color: var(--color-accent, #6c63ff); }
    .arrived .summary-icon { background: rgba(29,78,216,0.1); color: #1d4ed8; }
    .checked-in .summary-icon { background: rgba(21,128,61,0.1); color: #15803d; }
    .blacklisted .summary-icon { background: rgba(220,38,38,0.1); color: #dc2626; }

    .summary-info { display: flex; flex-direction: column; }
    .summary-value { font-size: 1.5rem; font-weight: 700; color: var(--color-text, #1e293b); line-height: 1.2; }
    .summary-label { font-size: 0.8rem; color: var(--color-text-secondary, #64748b); }

    /* Toolbar */
    .toolbar {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }
    .search-box {
      position: relative;
      flex: 1;
      min-width: 200px;
      max-width: 400px;
    }
    .search-icon {
      position: absolute;
      inset-inline-start: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-text-secondary, #94a3b8);
      font-size: 0.9rem;
    }
    .search-input {
      width: 100%;
      padding: 0.55rem 2.2rem;
      padding-inline-start: 2.2rem;
      padding-inline-end: 2.2rem;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-sm, 6px);
      font-size: 0.9rem;
      background: #fff;
      box-sizing: border-box;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--color-accent, #6c63ff);
      box-shadow: 0 0 0 2px rgba(108,99,255,0.15);
    }
    .search-clear {
      position: absolute;
      inset-inline-end: 0.5rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-secondary, #94a3b8);
      padding: 2px;
    }
    .filter-select {
      padding: 0.55rem 0.75rem;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-sm, 6px);
      font-size: 0.9rem;
      background: #fff;
      min-width: 140px;
    }
    .filter-select:focus {
      outline: none;
      border-color: var(--color-accent, #6c63ff);
    }
    .toolbar-right { margin-inline-start: auto; }
    .btn-refresh {
      width: 36px;
      height: 36px;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-sm, 6px);
      background: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-secondary, #64748b);
      transition: all 0.2s;
    }
    .btn-refresh:hover { background: #f8fafc; color: var(--color-accent, #6c63ff); }
    .spinning { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* States */
    .state-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      color: var(--color-text-secondary, #94a3b8);
      text-align: center;
    }
    .state-container i { font-size: 2.5rem; margin-bottom: 0.75rem; }
    .state-container h3 { margin: 0 0 0.5rem; color: var(--color-text, #1e293b); font-size: 1.1rem; }
    .state-container p { margin: 0; font-size: 0.9rem; }
    .error-state i { color: var(--color-danger, #e53935); }
    .btn-retry {
      margin-top: 1rem;
      padding: 0.5rem 1.25rem;
      border: 1px solid var(--color-accent, #6c63ff);
      border-radius: var(--radius-sm, 6px);
      background: transparent;
      color: var(--color-accent, #6c63ff);
      cursor: pointer;
      font-size: 0.9rem;
    }
    .btn-retry:hover { background: rgba(108,99,255,0.05); }

    .loading-dots {
      display: flex;
      gap: 6px;
      margin-bottom: 1rem;
    }
    .loading-dots span {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--color-accent, #6c63ff);
      animation: bounce 1.4s ease-in-out infinite;
    }
    .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
    .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Cards Grid */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1rem;
    }

    /* Visitor Card */
    .visitor-card {
      background: #fff;
      border-radius: var(--radius-md, 8px);
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      border: 1px solid var(--color-border, #e2e8f0);
      overflow: hidden;
      transition: box-shadow 0.2s, transform 0.15s;
      display: flex;
      flex-direction: column;
    }
    .visitor-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      transform: translateY(-1px);
    }

    /* Blacklisted card */
    .visitor-card.blacklisted {
      border-color: #fca5a5;
      background: #fef2f2;
    }
    .blacklist-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #dc2626;
      color: #fff;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .blacklist-banner i { font-size: 0.9rem; }
    .bl-reason { font-weight: 400; opacity: 0.9; }

    /* Card Header */
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1rem 1rem 0.5rem;
      gap: 0.5rem;
    }
    .visitor-name-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex: 1;
      min-width: 0;
    }
    .visitor-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--color-accent, #6c63ff);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.85rem;
      flex-shrink: 0;
    }
    .bl-avatar { background: #dc2626; }
    .visitor-identity { min-width: 0; }
    .visitor-name {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-text, #1e293b);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Status Badge */
    .status-badge {
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .status-arrived { background: rgba(29,78,216,0.1); color: #1d4ed8; }
    .status-checked-in { background: rgba(21,128,61,0.1); color: #15803d; }
    .status-checked-out { background: rgba(71,85,105,0.1); color: #475569; }

    /* Card Body */
    .card-body {
      padding: 0.5rem 1rem 0.75rem;
      flex: 1;
    }
    .info-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.2rem 0;
      font-size: 0.85rem;
      color: var(--color-text-secondary, #475569);
    }
    .info-row i {
      font-size: 0.82rem;
      color: var(--color-text-secondary, #94a3b8);
      width: 16px;
      text-align: center;
      flex-shrink: 0;
    }
    .info-label { font-weight: 500; color: var(--color-text, #1e293b); }

    .timestamps {
      display: flex;
      gap: 0.75rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }
    .timestamp {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.78rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .arrived-ts { background: rgba(29,78,216,0.08); color: #1d4ed8; }
    .checkedin-ts { background: rgba(21,128,61,0.08); color: #15803d; }

    /* Card Actions */
    .card-actions {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-top: 1px solid var(--color-border, #f1f5f9);
      background: #fafbfc;
    }
    .action-btn {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.65rem;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-sm, 6px);
      background: #fff;
      cursor: pointer;
      font-size: 0.8rem;
      color: var(--color-text-secondary, #475569);
      transition: all 0.15s;
      white-space: nowrap;
    }
    .action-btn:hover:not(:disabled) { border-color: var(--color-accent, #6c63ff); color: var(--color-accent, #6c63ff); }
    .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .check-in-btn:hover:not(:disabled) { border-color: #15803d; color: #15803d; background: rgba(21,128,61,0.04); }
    .check-out-btn:hover:not(:disabled) { border-color: #b45309; color: #b45309; background: rgba(180,83,9,0.04); }

    /* Pagination */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    .page-btn {
      width: 34px;
      height: 34px;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-sm, 6px);
      background: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-secondary, #64748b);
    }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-btn:hover:not(:disabled) { background: #f8fafc; }
    .page-info { font-size: 0.85rem; color: var(--color-text-secondary, #64748b); }

    /* Live Indicator */
    .live-indicator {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      justify-content: center;
      margin-top: 1rem;
      font-size: 0.75rem;
      color: var(--color-text-secondary, #94a3b8);
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      animation: pulse-live 2s ease-in-out infinite;
    }
    @keyframes pulse-live {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .on-site-page { padding: 1rem; }
      .header-content { flex-direction: column; }
      .cards-grid { grid-template-columns: 1fr; }
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
      .toolbar { flex-direction: column; align-items: stretch; }
      .search-box { max-width: none; }
      .toolbar-right { margin-inline-start: 0; }
    }

    @media (max-width: 480px) {
      .summary-cards { grid-template-columns: 1fr; }
      .card-actions { flex-wrap: wrap; }
      .action-btn span { display: none; }
    }
  `],
})
export class OnSiteComponent implements OnInit, OnDestroy {
  private visitsApi = inject(VisitsApiService);
  private wsService = inject(UserWebSocketService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private permissionService = inject(PermissionService);

  items: OnSiteVisitor[] = [];
  summary = { onSite: 0, arrived: 0, checkedIn: 0, blacklisted: 0 };
  loading = false;
  error = false;

  searchTerm = '';
  statusFilter = '';
  selectedDate: Date = new Date();
  currentPage = 1;
  totalPages = 1;
  private readonly pageSize = 50;

  private search$ = new Subject<string>();
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.loadData();

    // Debounced search
    this.subscriptions.push(
      this.search$.pipe(
        debounceTime(350),
        distinctUntilChanged(),
      ).subscribe(() => {
        this.currentPage = 1;
        this.loadData();
      }),
    );

    // WebSocket live updates
    this.subscriptions.push(
      this.wsService.on(WsEvent.VisitsVisitorArrived).subscribe(() => this.loadData()),
      this.wsService.on(WsEvent.VisitsVisitorCheckedIn).subscribe(() => this.loadData()),
      this.wsService.on(WsEvent.VisitsVisitorCheckedOut).subscribe(() => this.loadData()),
      this.wsService.on(WsEvent.VisitorsVisitorCheckedIn).subscribe(() => this.loadData()),
      this.wsService.on(WsEvent.VisitorsVisitorCheckedOut).subscribe(() => this.loadData()),
      this.wsService.on(WsEvent.VisitorsVisitorUpdated).subscribe(() => this.loadData()),
      this.wsService.on(WsEvent.VisitsVisitorSelfCheckedIn).subscribe(() => this.loadData()),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  loadData(): void {
    this.loading = true;
    this.error = false;
    this.cdr.markForCheck();

    this.visitsApi.getOnSiteVisitors({
      date: this.selectedDate ? this.formatDate(this.selectedDate) : undefined,
      search: this.searchTerm || undefined,
      status: this.statusFilter || undefined,
      page: this.currentPage,
      limit: this.pageSize,
    }).subscribe({
      next: (res: OnSiteResponse) => {
        this.items = res.items;
        this.summary = res.summary;
        this.totalPages = res.totalPages;
        this.loading = false;
        this.error = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.error = true;
        this.cdr.markForCheck();
      },
    });
  }

  onSearchChange(value: string): void {
    this.search$.next(value);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.loadData();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadData();
  }

  onDateSelect(): void {
    this.currentPage = 1;
    this.loadData();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadData();
  }

  // ── Actions ──

  onCheckIn(visitor: OnSiteVisitor): void {
    // Navigate to visit detail where check-in can be performed
    this.router.navigate(['/visits', visitor.visitId]);
  }

  onCheckOut(visitor: OnSiteVisitor): void {
    // Navigate to visit detail where check-out can be performed
    this.router.navigate(['/visits', visitor.visitId]);
  }

  viewVisitDetails(visitor: OnSiteVisitor): void {
    this.router.navigate(['/visits', visitor.visitId]);
  }

  // ── Helpers ──

  trackByVisitVisitorId(_index: number, item: OnSiteVisitor): string {
    return item.visitVisitorId;
  }

  getInitials(visitor: OnSiteVisitor): string {
    return ((visitor.visitorFirstName?.[0] ?? '') + (visitor.visitorLastName?.[0] ?? '')).toUpperCase();
  }

  getStatusClass(status: number): string {
    switch (status) {
      case 1: return 'status-badge status-arrived';
      case 2: return 'status-badge status-checked-in';
      case 3: return 'status-badge status-checked-out';
      default: return 'status-badge';
    }
  }

  getStatusLabel(status: number): string {
    switch (status) {
      case 1: return this.translate.instant('ON_SITE.ARRIVED');
      case 2: return this.translate.instant('ON_SITE.CHECKED_IN');
      case 3: return this.translate.instant('ON_SITE.CHECKED_OUT');
      default: return this.translate.instant('ON_SITE.PENDING');
    }
  }

  getHostName(visitor: OnSiteVisitor): string {
    return [visitor.visitRequesterFirstName, visitor.visitRequesterLastName].filter(Boolean).join(' ');
  }

  private static readonly timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return OnSiteComponent.timeFormatter.format(new Date(dateStr));
    } catch {
      return '';
    }
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
