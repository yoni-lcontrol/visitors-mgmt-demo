import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { TranslationService } from '../core/i18n/translation.service';
import { WorkstationSessionService } from '../core/services/workstation-session.service';
import { DeviceStatusService } from '../core/services/device-status.service';
import { ScannerEventService } from '../core/services/scanner-event.service';
import { AdSyncProgressService } from '../core/services/ad-sync-progress.service';
import { AcImportProgressService } from '../core/services/ac-import-progress.service';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, AsyncPipe, ToastModule, ProgressBarModule, TranslateModule],
  template: `
    <p-toast position="top-right" />
    @if ((acImport.progress$ | async); as importProgress) {
      @if (importProgress.phase !== 'idle') {
        <div class="ac-import-bar" [class.completed]="importProgress.phase === 'completed'" [class.failed]="importProgress.phase === 'failed'">
          <div class="ad-sync-bar-content">
            <div class="ad-sync-bar-info">
              @if (importProgress.phase === 'fetching' || importProgress.phase === 'processing') {
                <i class="pi pi-spin pi-spinner"></i>
              } @else if (importProgress.phase === 'completed') {
                <i class="pi pi-check-circle"></i>
              } @else if (importProgress.phase === 'failed') {
                <i class="pi pi-exclamation-triangle"></i>
              }
              <span class="ad-sync-bar-label">{{ 'AC_IMPORT.TITLE' | translate }}</span>
              @if (importProgress.phase === 'fetching') {
                <span class="ad-sync-bar-msg">{{ 'AC_IMPORT.FETCHING' | translate }}</span>
              } @else if (importProgress.phase === 'processing') {
                <span class="ad-sync-bar-msg">{{ importProgress.current }}/{{ importProgress.total }} — {{ 'ACCESS_CONTROL.CREATED' | translate }}: {{ importProgress.created }}, {{ 'ACCESS_CONTROL.UPDATED' | translate }}: {{ importProgress.updated }}</span>
              } @else if (importProgress.phase === 'completed') {
                <span class="ad-sync-bar-msg">{{ 'ACCESS_CONTROL.CREATED' | translate }}: {{ importProgress.created }}, {{ 'ACCESS_CONTROL.UPDATED' | translate }}: {{ importProgress.updated }}, {{ 'ACCESS_CONTROL.SKIPPED' | translate }}: {{ importProgress.skipped }}</span>
              } @else if (importProgress.phase === 'failed') {
                <span class="ad-sync-bar-msg">{{ importProgress.serviceDown ? ('AC_IMPORT.SERVICE_DOWN' | translate) : importProgress.message }}</span>
              }
            </div>
            <button class="ad-sync-bar-close" (click)="acImport.dismiss()" [title]="'COMMON.CLOSE' | translate">
              <i class="pi pi-times"></i>
            </button>
          </div>
          @if (importProgress.phase === 'processing' || importProgress.phase === 'fetching') {
            <p-progressBar [value]="importProgress.percent" [showValue]="false" [style]="{height: '3px'}"></p-progressBar>
          }
        </div>
      }
    }
    @if ((adSync.progress$ | async); as syncProgress) {
      @if (syncProgress.phase !== 'idle') {
        <div class="ad-sync-bar" [class.completed]="syncProgress.phase === 'completed'" [class.failed]="syncProgress.phase === 'failed'">
          <div class="ad-sync-bar-content">
            <div class="ad-sync-bar-info">
              @if (syncProgress.phase === 'fetching' || syncProgress.phase === 'processing') {
                <i class="pi pi-spin pi-spinner"></i>
              } @else if (syncProgress.phase === 'completed') {
                <i class="pi pi-check-circle"></i>
              } @else if (syncProgress.phase === 'failed') {
                <i class="pi pi-exclamation-triangle"></i>
              }
              <span class="ad-sync-bar-label">{{ 'AD_SYNC.TITLE' | translate }}</span>
              @if (syncProgress.phase === 'fetching') {
                <span class="ad-sync-bar-msg">{{ 'AD_SYNC.FETCHING' | translate }}</span>
              } @else if (syncProgress.phase === 'processing') {
                <span class="ad-sync-bar-msg">{{ syncProgress.current }}/{{ syncProgress.total }} — {{ 'AD_SYNC.CREATED' | translate }}: {{ syncProgress.created }}, {{ 'AD_SYNC.UPDATED' | translate }}: {{ syncProgress.updated }}</span>
              } @else if (syncProgress.phase === 'completed') {
                <span class="ad-sync-bar-msg">{{ 'AD_SYNC.CREATED' | translate }}: {{ syncProgress.created }}, {{ 'AD_SYNC.UPDATED' | translate }}: {{ syncProgress.updated }}, {{ 'AD_SYNC.DEACTIVATED' | translate }}: {{ syncProgress.deactivated }}</span>
              } @else if (syncProgress.phase === 'failed') {
                <span class="ad-sync-bar-msg">{{ syncProgress.message }}</span>
              }
            </div>
            <button class="ad-sync-bar-close" (click)="adSync.dismiss()" [title]="'COMMON.CLOSE' | translate">
              <i class="pi pi-times"></i>
            </button>
          </div>
          @if (syncProgress.phase === 'processing' || syncProgress.phase === 'fetching') {
            <p-progressBar [value]="syncProgress.percent" [showValue]="false" [style]="{height: '3px'}"></p-progressBar>
          }
        </div>
      }
    }
    <div class="app-layout" [class.sidebar-open]="sidebarOpen" [class.rtl]="(translation.direction$ | async) === 'rtl'">
      <div class="sidebar-backdrop" (click)="sidebarOpen = false"></div>
      <app-sidebar [collapsed]="!sidebarOpen" (closeSidebar)="sidebarOpen = false" (menuItemClicked)="onMobileMenuClick()" />
      <div class="app-main">
        <app-header (toggleSidebar)="sidebarOpen = !sidebarOpen" />
        <main class="app-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
      .ac-import-bar {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 1100;
        min-width: 360px;
        max-width: 520px;
        background: var(--color-surface, #fff);
        border-radius: 10px;
        box-shadow: 0 4px 24px rgba(2, 1, 64, 0.16);
        border: 1.5px solid #1565c0;
        overflow: hidden;
        animation: adSyncSlideIn 0.3s ease;
      }
      .ac-import-bar.completed { border-color: #2e7d32; }
      .ac-import-bar.failed { border-color: #c62828; }
      .ac-import-bar .ad-sync-bar-info > i { color: #1565c0; }
      .ac-import-bar.completed .ad-sync-bar-info > i { color: #2e7d32; }
      .ac-import-bar.failed .ad-sync-bar-info > i { color: #c62828; }
      :host ::ng-deep .ac-import-bar .p-progressbar {
        border-radius: 0;
        background: transparent;
      }
      :host ::ng-deep .ac-import-bar .p-progressbar .p-progressbar-value {
        background: #1565c0;
        border-radius: 0;
      }
      .ad-sync-bar {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 1100;
        min-width: 360px;
        max-width: 520px;
        background: var(--color-surface, #fff);
        border-radius: 10px;
        box-shadow: 0 4px 24px rgba(2, 1, 64, 0.16);
        border: 1.5px solid var(--color-accent, #6c63ff);
        overflow: hidden;
        animation: adSyncSlideIn 0.3s ease;
      }
      .ad-sync-bar.completed { border-color: #2e7d32; }
      .ad-sync-bar.failed { border-color: #c62828; }
      .ad-sync-bar-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
      }
      .ad-sync-bar-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
        min-width: 0;
      }
      .ad-sync-bar-info > i {
        font-size: 1.1rem;
        color: var(--color-accent, #6c63ff);
        flex-shrink: 0;
      }
      .ad-sync-bar.completed .ad-sync-bar-info > i { color: #2e7d32; }
      .ad-sync-bar.failed .ad-sync-bar-info > i { color: #c62828; }
      .ad-sync-bar-label {
        font-weight: 600;
        font-size: 0.85rem;
        white-space: nowrap;
      }
      .ad-sync-bar-msg {
        font-size: 0.8rem;
        color: var(--color-text-secondary, #5c5a78);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ad-sync-bar-close {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-muted, #9896ad);
        padding: 0.25rem;
        border-radius: 4px;
        flex-shrink: 0;
      }
      .ad-sync-bar-close:hover { color: var(--color-text, #020140); }
      :host ::ng-deep .ad-sync-bar .p-progressbar {
        border-radius: 0;
        background: transparent;
      }
      :host ::ng-deep .ad-sync-bar .p-progressbar .p-progressbar-value {
        background: var(--color-accent, #6c63ff);
        border-radius: 0;
      }
      @keyframes adSyncSlideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .app-layout {
        display: flex;
        height: 100vh;
        direction: ltr;
      }
      .app-layout.rtl {
        direction: rtl;
      }
      .sidebar-backdrop {
        display: none;
      }
      .app-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-width: 0;
      }
      .app-content {
        flex: 1;
        padding: var(--content-padding, 1.75rem);
        overflow-y: auto;
        background-color: var(--color-bg, #f5f4fa);
      }

      @media (max-width: 767px) {
        .sidebar-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(2, 1, 64, 0.45);
          z-index: 998;
          backdrop-filter: blur(2px);
        }
        .app-layout.sidebar-open .sidebar-backdrop {
          display: block;
        }
      }
    `],
})
export class LayoutComponent implements OnInit {
  translation = inject(TranslationService);
  adSync = inject(AdSyncProgressService);
  acImport = inject(AcImportProgressService);
  private wsSession = inject(WorkstationSessionService);
  private deviceStatus = inject(DeviceStatusService);
  private scannerEvent = inject(ScannerEventService);
  sidebarOpen = true;

  ngOnInit(): void {
    this.wsSession.initListeners();
    this.deviceStatus.initListeners();
    this.scannerEvent.initListeners();
    this.adSync.initListeners();
    this.acImport.initListeners();
    this.wsSession.restoreSession();
  }

  onMobileMenuClick(): void {
    if (window.innerWidth < 768) {
      this.sidebarOpen = false;
    }
  }
}
