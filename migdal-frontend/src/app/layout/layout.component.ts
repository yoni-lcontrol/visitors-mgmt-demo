import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { TranslationService } from '../core/i18n/translation.service';
import { WorkstationSessionService } from '../core/services/workstation-session.service';
import { DeviceStatusService } from '../core/services/device-status.service';
import { ScannerEventService } from '../core/services/scanner-event.service';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, AsyncPipe, ToastModule],
  template: `
    <p-toast position="top-right" />
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
        background-image: url('/images/Migdal_BG-mixed.png');
        background-repeat: no-repeat;
        background-position: center center;
        background-size: cover;
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
  private wsSession = inject(WorkstationSessionService);
  private deviceStatus = inject(DeviceStatusService);
  private scannerEvent = inject(ScannerEventService);
  sidebarOpen = true;

  ngOnInit(): void {
    this.wsSession.initListeners();
    this.deviceStatus.initListeners();
    this.scannerEvent.initListeners();
    this.wsSession.restoreSession();
  }

  onMobileMenuClick(): void {
    if (window.innerWidth < 768) {
      this.sidebarOpen = false;
    }
  }
}
