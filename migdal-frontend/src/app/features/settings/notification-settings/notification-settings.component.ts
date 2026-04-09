import { Component, OnInit, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/api/api.service';
import { NotificationService } from '@core/notifications/notification.service';
import { NotificationSetting, SmsTemplate } from '@core/models/entities.model';
import { HasUnsavedChanges } from '@core/guards/unsaved-changes.guard';

interface MatrixCell {
  sms: boolean;
  email: boolean;
}

const TARGET_GROUPS = ['system_users', 'visitors', 'escorts', 'visit_requester'] as const;
const EVENTS = ['visitor_arrived', 'visit_created', 'visit_updated', 'visit_deleted', 'visitor_blacklisted', 'check_in_code_sent', 'parking_request_decision', 'visitor_checked_out', 'visitor_overstay'] as const;

@Component({
  selector: 'app-notification-settings',
  standalone: true,
  imports: [TranslateModule, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>{{ 'NOTIFICATION_SETTINGS.TITLE' | translate }}</h1>
        <p class="page-subtitle">{{ 'NOTIFICATION_SETTINGS.DESCRIPTION' | translate }}</p>
      </div>
    </div>

    @if (loading) {
      <div class="loading-state">
        <i class="pi pi-spin pi-spinner"></i>
        <span>{{ 'COMMON.LOADING' | translate }}</span>
      </div>
    } @else {
      <div class="groups-grid">
        @for (group of targetGroups; track group) {
          <div class="card group-card">
            <div class="group-card-header">
              <div class="group-icon-wrap">
                <i class="pi" [class]="getGroupIcon(group)"></i>
              </div>
              <div class="group-title-wrap">
                <h3 class="group-title">{{ 'NOTIFICATION_SETTINGS.GROUP_' + group.toUpperCase() | translate }}</h3>
                <p class="group-desc">{{ 'NOTIFICATION_SETTINGS.GROUP_DESC_' + group.toUpperCase() | translate }}</p>
              </div>
              <span class="group-active-badge" [class.has-active]="getActiveCount(group) > 0">
                {{ getActiveCount(group) }}/{{ events.length * 2 }}
              </span>
            </div>

            <div class="events-list">
              <div class="events-col-headers">
                <span class="col-header-spacer"></span>
                <div class="col-header-channels">
                  <span class="col-header"><i class="pi pi-envelope"></i> {{ 'NOTIFICATION_SETTINGS.EMAIL' | translate }}</span>
                  <span class="col-header"><i class="pi pi-mobile"></i> {{ 'NOTIFICATION_SETTINGS.SMS' | translate }}</span>
                </div>
              </div>
              @for (event of events; track event; let last = $last; let even = $even) {
                <div class="event-row" [class.last]="last" [class.even]="even">
                  <div class="event-info">
                    <i class="pi event-icon" [class]="getEventIcon(event)"></i>
                    <span class="event-label">{{ 'NOTIFICATION_SETTINGS.EVENT_' + event.toUpperCase() | translate }}</span>
                  </div>
                  <div class="channel-toggles">
                    <label class="toggle-switch" [class.active]="getCell(group, event).email"
                      [attr.title]="'NOTIFICATION_SETTINGS.EMAIL' | translate">
                      <input type="checkbox" [checked]="getCell(group, event).email"
                        (change)="toggleCell(group, event, 'email')" [disabled]="saving">
                      <span class="toggle-track">
                        <span class="toggle-thumb"></span>
                      </span>
                    </label>
                    <label class="toggle-switch" [class.active]="getCell(group, event).sms"
                      [attr.title]="'NOTIFICATION_SETTINGS.SMS' | translate">
                      <input type="checkbox" [checked]="getCell(group, event).sms"
                        (change)="toggleCell(group, event, 'sms')" [disabled]="saving">
                      <span class="toggle-track">
                        <span class="toggle-thumb"></span>
                      </span>
                    </label>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- SMS Templates Section -->
      <div class="section-divider-lg">
        <div class="section-header-row">
          <div class="section-icon-wrap">
            <i class="pi pi-mobile"></i>
          </div>
          <div>
            <h2 class="section-title">{{ 'SMS_TEMPLATES.TITLE' | translate }}</h2>
            <p class="section-desc">{{ 'SMS_TEMPLATES.DESCRIPTION' | translate }}</p>
          </div>
        </div>
      </div>

      @if (smsLoading) {
        <div class="loading-state">
          <i class="pi pi-spin pi-spinner"></i>
          <span>{{ 'COMMON.LOADING' | translate }}</span>
        </div>
      } @else {
        <div class="sms-group-tabs">
          @for (group of targetGroups; track group) {
            <button class="sms-group-tab" [class.active]="selectedSmsGroup === group"
              (click)="selectSmsGroup(group)">
              <i class="pi" [class]="getGroupIcon(group)"></i>
              <span>{{ 'NOTIFICATION_SETTINGS.GROUP_' + group.toUpperCase() | translate }}</span>
            </button>
          }
        </div>

        <div class="sms-templates-grid" [class.sms-grid-entering]="smsGridAnimating">
          @for (tpl of getSmsTemplatesForGroup(selectedSmsGroup); track tpl.event) {
            <div class="card sms-template-card">
              <div class="sms-template-header">
                <div class="sms-template-info">
                  <i class="pi event-icon" [class]="getEventIcon(tpl.event)"></i>
                  <span class="sms-template-event">{{ 'NOTIFICATION_SETTINGS.EVENT_' + tpl.event.toUpperCase() | translate }}</span>
                </div>
              </div>
              <div class="sms-template-body">
                <div class="field">
                  <label>{{ 'SMS_TEMPLATES.TEMPLATE' | translate }}</label>
                  <textarea [(ngModel)]="tpl.template" rows="3" (input)="smsDirty = true"
                    [placeholder]="'SMS_TEMPLATES.TEMPLATE_PLACEHOLDER' | translate"
                    [disabled]="smsSaving"></textarea>
                </div>
              </div>
              <div class="sms-template-footer">
                <div class="footer-actions">
                  <button class="action-btn action-btn--preview" (click)="previewTemplate(tpl)" [disabled]="smsSaving">
                    <i class="pi pi-eye"></i>
                    <span>{{ 'SMS_TEMPLATES.PREVIEW' | translate }}</span>
                  </button>
                  <button class="action-btn action-btn--test" (click)="tpl._showTestInput = !tpl._showTestInput" [disabled]="smsSaving"
                    [class.active]="tpl._showTestInput">
                    <i class="pi pi-send"></i>
                    <span>{{ 'SMS_TEMPLATES.TEST_SMS' | translate }}</span>
                  </button>
                </div>
                @if (tpl._preview) {
                  <div class="preview-result">
                    <div class="preview-result__header">
                      <i class="pi pi-eye"></i>
                      <span>{{ 'SMS_TEMPLATES.PREVIEW_RESULT' | translate }}</span>
                    </div>
                    <div class="preview-result__body">{{ tpl._preview }}</div>
                  </div>
                }
                @if (tpl._showTestInput) {
                  <div class="test-sms-panel">
                    <div class="test-sms-panel__header">
                      <i class="pi pi-send"></i>
                      <span>{{ 'SMS_TEMPLATES.TEST_SMS' | translate }}</span>
                    </div>
                    <div class="test-sms-panel__body">
                      <input type="text" [(ngModel)]="tpl._testPhone"
                        [placeholder]="'SMS_TEMPLATES.TEST_PHONE_PLACEHOLDER' | translate"
                        [disabled]="tpl._testSending" class="test-phone-input" />
                      <button class="action-btn action-btn--send" (click)="sendTestSms(tpl)"
                        [disabled]="tpl._testSending || !tpl._testPhone.trim()">
                        @if (tpl._testSending) {
                          <i class="pi pi-spin pi-spinner"></i>
                        } @else {
                          <i class="pi pi-send"></i>
                        }
                        <span>{{ 'SMS_TEMPLATES.SEND_TEST' | translate }}</span>
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Placeholders Reference -->
        @if (smsPlaceholders.length) {
          <div class="card placeholders-card">
            <button class="placeholders-toggle" (click)="placeholdersExpanded = !placeholdersExpanded">
              <div class="placeholders-header">
                <i class="pi pi-info-circle"></i>
                <span>{{ 'SMS_TEMPLATES.PLACEHOLDERS_TITLE' | translate }}</span>
                <span class="placeholders-count">{{ smsPlaceholders.length }}</span>
              </div>
              <i class="pi placeholders-chevron" [class.pi-chevron-down]="!placeholdersExpanded" [class.pi-chevron-up]="placeholdersExpanded"></i>
            </button>
            @if (placeholdersExpanded) {
              <table class="placeholders-table">
                @for (ph of smsPlaceholders; track ph) {
                  <tr>
                    <td><code class="placeholder-tag">{{ ph }}</code></td>
                    <td class="placeholder-desc">{{ getPlaceholderDescription(ph) }}</td>
                  </tr>
                }
              </table>
            }
          </div>
        }
      }

      <div class="save-bar" [class.has-changes]="dirty || smsDirty">
        @if (dirty || smsDirty) {
          <span class="unsaved-hint">
            <i class="pi pi-exclamation-circle"></i>
            {{ 'NOTIFICATION_SETTINGS.UNSAVED_CHANGES' | translate }}
          </span>
        }
        <button class="btn btn-primary save-btn" (click)="saveAll()" [disabled]="(saving || smsSaving) || (!dirty && !smsDirty)">
          @if (saving || smsSaving) {
            <i class="pi pi-spin pi-spinner"></i>
            {{ 'NOTIFICATION_SETTINGS.SAVING' | translate }}
          } @else {
            <i class="pi pi-save"></i>
            {{ 'COMMON.SAVE' | translate }}
          }
        </button>
      </div>
    }
  `,
  styles: [`
    /* ── Page ── */
    :host { display: block; padding-bottom: 5rem; }

    .page-subtitle {
      color: var(--color-text-secondary, #5c5a78);
      font-size: 0.88rem;
      margin-top: 0.25rem;
    }

    /* ── Loading ── */
    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 3rem 1rem;
      color: var(--color-text-muted, #9896ad);
      font-size: 0.95rem;
    }
    .loading-state i { font-size: 1.5rem; }

    /* ── Groups grid ── */
    .groups-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
      gap: 1.25rem;
    }

    /* ── Group card ── */
    .group-card {
      padding: 0 !important;
      overflow: hidden;
      transition: box-shadow 0.2s;
    }
    .group-card:hover {
      box-shadow: var(--shadow-md, 0 4px 12px rgba(2,1,64,0.08));
    }

    .group-card-header {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 1rem 1.25rem;
      background: var(--color-primary-wash, #eeedf8);
      border-bottom: 1px solid var(--color-border, #e4e2f0);
    }

    .group-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--color-accent, #6c63ff);
      color: #fff;
      flex-shrink: 0;
    }
    .group-icon-wrap i { font-size: 1.05rem; }

    .group-title-wrap { flex: 1; min-width: 0; }

    .group-title {
      font-size: 0.92rem;
      font-weight: 600;
      color: var(--color-primary, #020140);
      margin: 0;
    }
    .group-desc {
      font-size: 0.76rem;
      color: var(--color-text-muted, #9896ad);
      margin: 0.1rem 0 0;
    }

    .group-active-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
      background: var(--color-surface, #fff);
      color: var(--color-text-muted, #9896ad);
      border: 1px solid var(--color-border, #e4e2f0);
      flex-shrink: 0;
      letter-spacing: 0.02em;
    }
    .group-active-badge.has-active {
      background: rgba(34, 197, 94, 0.1);
      color: #15803d;
      border-color: rgba(34, 197, 94, 0.2);
    }

    /* ── Events column headers ── */
    .events-col-headers {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.45rem 1.25rem;
      background: var(--color-surface-alt, #f8f7fc);
      border-bottom: 1px solid var(--color-border-light, #f0eff5);
    }
    .col-header-spacer { flex: 1; }
    .col-header-channels {
      display: flex;
      gap: 1.5rem;
      flex-shrink: 0;
    }
    .col-header {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted, #9896ad);
      width: 36px;
      justify-content: center;
    }
    .col-header i { font-size: 0.7rem; }

    /* ── Event rows ── */
    .events-list { padding: 0; }

    .event-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.7rem 1.25rem;
      border-bottom: 1px solid var(--color-border-light, #f0eff5);
      transition: background 0.15s;
    }
    .event-row.even { background: var(--color-surface-alt, #f8f7fc); }
    .event-row:hover { background: var(--color-primary-wash, #eeedf8); }
    .event-row.last { border-bottom: none; }

    .event-info {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      min-width: 0;
      flex: 1;
    }
    .event-icon {
      font-size: 0.85rem;
      color: var(--color-text-muted, #9896ad);
      width: 1.25rem;
      text-align: center;
      flex-shrink: 0;
    }
    .event-label {
      font-size: 0.84rem;
      font-weight: 500;
      color: var(--color-text, #1a1a2e);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Channel toggles ── */
    .channel-toggles {
      display: flex;
      gap: 1.5rem;
      flex-shrink: 0;
    }

    /* ── Toggle switch ── */
    .toggle-switch {
      position: relative;
      display: inline-flex;
      cursor: pointer;
      user-select: none;
    }
    .toggle-switch input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-track {
      width: 36px;
      height: 20px;
      border-radius: 20px;
      background: var(--color-border, #d8d7e5);
      position: relative;
      transition: background 0.2s;
    }
    .toggle-thumb {
      position: absolute;
      top: 2px;
      inset-inline-start: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      transition: inset-inline-start 0.2s, transform 0.2s;
    }
    .toggle-switch.active .toggle-track {
      background: var(--color-accent, #6c63ff);
    }
    .toggle-switch.active .toggle-thumb {
      inset-inline-start: 18px;
    }
    .toggle-switch:hover .toggle-track {
      background: var(--color-text-muted, #9896ad);
    }
    .toggle-switch.active:hover .toggle-track {
      background: var(--color-accent-hover, #5a52e0);
    }
    .toggle-switch:focus-within .toggle-track {
      box-shadow: 0 0 0 2px var(--color-accent-subtle, #ddd9ff);
    }
    .toggle-switch input:disabled ~ .toggle-track {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .toggle-switch:has(input:disabled) {
      cursor: not-allowed;
    }

    /* ── Sticky save bar ── */
    .save-bar {
      position: fixed;
      bottom: 0;
      left: var(--sidebar-width, 260px);
      right: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 1rem;
      padding: 0.85rem var(--content-padding, 1.75rem);
      background: var(--color-surface, #fff);
      border-top: 1px solid var(--color-border, #e4e2f0);
      z-index: 10;
      transition: box-shadow 0.2s, background 0.2s;
    }
    .save-bar.has-changes {
      background: #fffde7;
      border-top-color: #f9a825;
      box-shadow: 0 -2px 12px rgba(249, 168, 37, 0.12);
    }

    .save-btn {
      min-width: 140px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;
    }
    .save-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .save-btn i.pi-spinner { font-size: 0.9rem; }

    .unsaved-hint {
      font-size: 0.82rem;
      color: #e65100;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      animation: fadeIn 0.2s ease-out;
    }
    .unsaved-hint i { font-size: 0.85rem; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Responsive ── */
    @media (max-width: 959px) {
      .groups-grid {
        grid-template-columns: 1fr;
      }
      .save-bar {
        left: 0;
      }
    }

    @media (max-width: 599px) {
      .event-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
        padding: 0.7rem 1rem;
      }
      .channel-toggles {
        padding-inline-start: 1.8rem;
      }
      .events-col-headers { display: none; }
    }

    /* ── SMS Templates Section ── */
    .section-divider-lg {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 2px solid var(--color-border, #e4e2f0);
    }
    .section-header-row {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
    }
    .section-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--color-accent, #6c63ff);
      color: #fff;
      flex-shrink: 0;
    }
    .section-icon-wrap i { font-size: 1.05rem; }
    .section-title {
      font-size: 1.05rem; font-weight: 600; color: var(--color-primary, #020140); margin: 0;
    }
    .section-desc {
      color: var(--color-text-secondary, #5c5a78); font-size: 0.84rem; margin: 0.2rem 0 0;
    }

    /* ── SMS Group Tabs ── */
    .sms-group-tabs {
      display: flex;
      gap: 0.5rem;
      margin-top: 1.15rem;
      flex-wrap: wrap;
    }
    .sms-group-tab {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm, 6px);
      font-size: 0.84rem;
      font-weight: 500;
      cursor: pointer;
      border: 1.5px solid var(--color-border, #e4e2f0);
      background: var(--color-surface, #fff);
      color: var(--color-text-secondary, #5c5a78);
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .sms-group-tab:hover {
      background: var(--color-primary-wash, #eeedf8);
      border-color: var(--color-accent-subtle, #ddd9ff);
    }
    .sms-group-tab.active {
      background: var(--color-accent, #6c63ff);
      color: #fff;
      border-color: var(--color-accent, #6c63ff);
    }
    .sms-group-tab i {
      font-size: 0.85rem;
    }

    .sms-templates-grid {
      display: grid; grid-template-columns: 1fr; gap: 1rem; margin-top: 1.15rem;
      opacity: 1;
      transform: translateY(0);
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    .sms-templates-grid.sms-grid-entering {
      opacity: 0;
      transform: translateY(6px);
    }
    .sms-template-card { padding: 0 !important; overflow: hidden; }
    .sms-template-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.85rem 1.15rem;
      background: var(--color-surface-alt, #f8f7fc);
      border-bottom: 1px solid var(--color-border-light, #f0eff5);
    }
    .sms-template-info { display: flex; align-items: center; gap: 0.5rem; }
    .sms-template-event { font-weight: 600; font-size: 0.88rem; color: var(--color-primary, #020140); }
    .sms-template-body { padding: 1rem 1.15rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .sms-template-body .field { display: flex; flex-direction: column; gap: 0.25rem; }
    .sms-template-body .field label { font-weight: 500; font-size: 0.82rem; color: var(--color-text-secondary); }
    .sms-template-body textarea {
      width: 100%; font-family: inherit; font-size: 0.85rem; padding: 0.5rem 0.65rem;
      border: 1.5px solid var(--color-border, #e4e2f0); border-radius: var(--radius-sm, 6px);
      resize: vertical; min-height: 60px; transition: border-color 0.2s;
    }
    .sms-template-body textarea:focus { border-color: var(--color-accent, #6c63ff); outline: none; }
    .sms-template-body input {
      width: 100%; font-family: inherit; font-size: 0.85rem; padding: 0.4rem 0.65rem;
      border: 1.5px solid var(--color-border, #e4e2f0); border-radius: var(--radius-sm, 6px);
    }
    .sms-template-body input:focus { border-color: var(--color-accent, #6c63ff); outline: none; }
    .field-hint { font-size: 0.75rem; color: var(--color-text-muted, #9896ad); }
    .sms-template-footer {
      padding: 0.75rem 1.15rem; border-top: 1px solid var(--color-border-light, #f0eff5);
      display: flex; flex-direction: column; gap: 0.65rem;
    }
    .footer-actions {
      display: flex; gap: 0.5rem; flex-wrap: wrap;
    }
    .action-btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.4rem 0.85rem; border-radius: var(--radius-sm, 6px);
      font-size: 0.82rem; font-weight: 500; cursor: pointer;
      border: 1.5px solid transparent; transition: all 0.15s ease;
    }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .action-btn i { font-size: 0.85rem; }
    .action-btn--preview {
      background: var(--color-primary-wash, #eeedf8); color: var(--color-primary, #020140);
      border-color: var(--color-border, #e4e2f0);
    }
    .action-btn--preview:hover:not(:disabled) {
      background: var(--color-accent-subtle, #ddd9ff); border-color: var(--color-accent-subtle, #ddd9ff);
      color: var(--color-accent, #6c63ff);
    }
    .action-btn--test {
      background: var(--color-surface, #fff); color: var(--color-accent, #6c63ff);
      border-color: var(--color-accent, #6c63ff);
    }
    .action-btn--test:hover:not(:disabled), .action-btn--test.active {
      background: var(--color-accent, #6c63ff); color: #fff;
    }
    .action-btn--send {
      background: var(--color-accent, #6c63ff); color: #fff;
      border-color: var(--color-accent, #6c63ff); white-space: nowrap;
    }
    .action-btn--send:hover:not(:disabled) { background: var(--color-accent-hover, #5b52e0); }
    .preview-result {
      background: var(--color-primary-wash, #eeedf8); border-radius: var(--radius-sm, 6px);
      overflow: hidden;
    }
    .preview-result__header {
      display: flex; align-items: center; gap: 0.35rem;
      padding: 0.45rem 0.75rem; font-size: 0.78rem; font-weight: 600;
      color: var(--color-primary, #020140); background: rgba(108, 99, 255, 0.08);
    }
    .preview-result__header i { font-size: 0.8rem; color: var(--color-accent, #6c63ff); }
    .preview-result__body {
      padding: 0.55rem 0.75rem; font-size: 0.84rem; line-height: 1.5;
      color: var(--color-text, #1a1a2e); direction: rtl;
    }
    .test-sms-panel {
      background: var(--color-surface-alt, #f7f6fc); border: 1.5px solid var(--color-accent, #6c63ff);
      border-radius: var(--radius-sm, 6px); overflow: hidden;
    }
    .test-sms-panel__header {
      display: flex; align-items: center; gap: 0.35rem;
      padding: 0.45rem 0.75rem; font-size: 0.78rem; font-weight: 600;
      color: #fff; background: var(--color-accent, #6c63ff);
    }
    .test-sms-panel__header i { font-size: 0.8rem; }
    .test-sms-panel__body {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem;
    }
    .test-phone-input {
      flex: 1; padding: 0.45rem 0.65rem; font-size: 0.84rem; border-radius: var(--radius-sm, 6px);
      border: 1.5px solid var(--color-border, #e4e2f0); direction: ltr; text-align: left;
      transition: border-color 0.15s ease;
    }
    .test-phone-input:focus { border-color: var(--color-accent, #6c63ff); outline: none; box-shadow: 0 0 0 2px rgba(108,99,255,0.12); }
    .btn-sm { font-size: 0.8rem; padding: 0.3rem 0.7rem; }

    /* ── Placeholders (collapsible) ── */
    .placeholders-card {
      margin-top: 1rem; padding: 0 !important; overflow: hidden;
    }
    .placeholders-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0.85rem 1.15rem;
      border: none;
      background: transparent;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .placeholders-toggle:hover { background: var(--color-surface-alt, #f8f7fc); }
    .placeholders-header {
      display: flex; align-items: center; gap: 0.4rem;
      font-weight: 600; font-size: 0.88rem; color: var(--color-primary, #020140);
    }
    .placeholders-header i { color: var(--color-accent, #6c63ff); }
    .placeholders-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 1.4rem; height: 1.4rem; border-radius: 999px;
      background: var(--color-primary-wash, #eeedf8); color: var(--color-accent, #6c63ff);
      font-size: 0.7rem; font-weight: 700;
    }
    .placeholders-chevron {
      font-size: 0.8rem; color: var(--color-text-muted, #9896ad);
      transition: transform 0.2s;
    }
    .placeholders-table { width: 100%; border-collapse: collapse; }
    .placeholders-table tr { border-top: 1px solid var(--color-border-light, #f0eff5); }
    .placeholders-table tr:last-child { border-bottom: none; }
    .placeholders-table td { padding: 0.45rem 1.15rem; vertical-align: middle; }
    .placeholders-table td:first-child { white-space: nowrap; width: 1%; }
    .placeholder-desc { font-size: 0.8rem; color: var(--color-text-secondary, #5c5a78); }
    .placeholder-tag {
      display: inline-block; background: var(--color-primary-wash, #eeedf8); color: var(--color-accent, #6c63ff);
      padding: 0.2rem 0.55rem; border-radius: 4px; font-size: 0.78rem; font-family: monospace;
    }
  `],
})
export class NotificationSettingsComponent implements OnInit, HasUnsavedChanges {
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  private translate = inject(TranslateService);

  targetGroups = [...TARGET_GROUPS];
  events = [...EVENTS];

  matrix: Record<string, Record<string, MatrixCell>> = {};
  saving = false;
  loading = true;
  dirty = false;

  // SMS Templates
  smsTemplates: SmsTemplateRow[] = [];
  smsPlaceholders: string[] = [];
  smsLoading = true;
  smsSaving = false;
  smsDirty = false;
  placeholdersExpanded = false;
  selectedSmsGroup: string = TARGET_GROUPS[0];
  smsGridAnimating = false;

  selectSmsGroup(group: string): void {
    if (group === this.selectedSmsGroup) return;
    this.smsGridAnimating = true;
    setTimeout(() => {
      this.selectedSmsGroup = group;
      this.smsGridAnimating = false;
    }, 180);
  }

  hasUnsavedChanges(): boolean {
    return this.dirty || this.smsDirty;
  }

  ngOnInit(): void {
    this.initMatrix();
    this.loadSettings();
    this.loadSmsTemplates();
    this.loadPlaceholders();
  }

  private initMatrix(): void {
    for (const group of this.targetGroups) {
      this.matrix[group] = {};
      for (const event of this.events) {
        this.matrix[group][event] = { sms: false, email: false };
      }
    }
  }

  private loadSettings(): void {
    this.loading = true;
    this.api.get<NotificationSetting[]>('/settings/notifications').subscribe({
      next: (settings) => {
        for (const s of settings) {
          if (this.matrix[s.targetGroup]?.[s.event]) {
            if (s.channel === 'sms') this.matrix[s.targetGroup][s.event].sms = s.enabled;
            if (s.channel === 'email') this.matrix[s.targetGroup][s.event].email = s.enabled;
          }
        }
        this.dirty = false;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private loadSmsTemplates(): void {
    this.smsLoading = true;
    this.api.get<SmsTemplate[]>('/settings/sms-templates').subscribe({
      next: (templates) => {
        const byKey = new Map(templates.map((t) => [`${t.event}::${t.targetGroup}`, t]));
        this.smsTemplates = [];
        for (const group of this.targetGroups) {
          for (const event of this.events) {
            const existing = byKey.get(`${event}::${group}`);
            this.smsTemplates.push({
              id: existing?.id ?? '',
              event,
              targetGroup: group,
              template: existing?.template ?? '',
              recipients: existing?.recipients ?? null,
              _preview: '',
              _testPhone: '',
              _testSending: false,
              _showTestInput: false,
            });
          }
        }
        this.smsDirty = false;
        this.smsLoading = false;
      },
      error: () => {
        this.smsLoading = false;
      },
    });
  }

  private loadPlaceholders(): void {
    this.api.get<{ placeholders: string[] }>('/settings/sms-templates/placeholders').subscribe({
      next: (res) => { this.smsPlaceholders = res.placeholders; },
      error: () => { },
    });
  }

  getCell(group: string, event: string): MatrixCell {
    return this.matrix[group]?.[event] ?? { sms: false, email: false };
  }

  toggleCell(group: string, event: string, channel: 'sms' | 'email'): void {
    if (this.saving) return;
    const cell = this.matrix[group][event];
    cell[channel] = !cell[channel];
    this.dirty = true;
  }

  getEventIcon(event: string): string {
    const icons: Record<string, string> = {
      visitor_arrived: 'pi-sign-in',
      visit_created: 'pi-plus-circle',
      visit_updated: 'pi-pencil',
      visitor_deleted: 'pi-trash',
      visitor_blacklisted: 'pi-ban',
      check_in_code_sent: 'pi-key',
      parking_request_decision: 'pi-car',
      visitor_checked_out: 'pi-sign-out',
      visitor_overstay: 'pi-clock',
    };
    return icons[event] ?? 'pi-bell';
  }

  getGroupIcon(group: string): string {
    const icons: Record<string, string> = {
      system_users: 'pi-users',
      visitors: 'pi-user',
      escorts: 'pi-shield',
      visit_requester: 'pi-briefcase',
    };
    return icons[group] ?? 'pi-bell';
  }

  getActiveCount(group: string): number {
    let count = 0;
    for (const event of this.events) {
      const cell = this.matrix[group]?.[event];
      if (cell?.email) count++;
      if (cell?.sms) count++;
    }
    return count;
  }

  getPlaceholderDescription(placeholder: string): string {
    // Strip {{ and }} to get dot path, then build i18n key
    const key = placeholder.replace(/\{|\}/g, '').replace(/\./g, '_').toUpperCase();
    const translated = this.translate.instant('SMS_TEMPLATES.PH_' + key);
    // If key not found, ngx-translate returns the key itself
    if (translated === 'SMS_TEMPLATES.PH_' + key) return placeholder;
    return translated;
  }

  getSmsTemplatesForGroup(group: string): SmsTemplateRow[] {
    return this.smsTemplates.filter((t) => t.targetGroup === group);
  }

  previewTemplate(tpl: SmsTemplateRow): void {
    this.api.post<{ rendered: string }>('/settings/sms-templates/preview', {
      event: tpl.event,
      targetGroup: tpl.targetGroup,
      template: tpl.template,
    }).subscribe({
      next: (res) => { tpl._preview = res.rendered; },
      error: (err) => { this.notify.error(err); },
    });
  }

  sendTestSms(tpl: SmsTemplateRow): void {
    if (tpl._testSending || !tpl._testPhone?.trim()) return;
    tpl._testSending = true;
    this.api.post<{ success: boolean }>('/settings/sms-templates/test', {
      event: tpl.event,
      template: tpl.template,
      phone: tpl._testPhone.trim(),
    }).subscribe({
      next: () => {
        tpl._testSending = false;
        this.notify.success('SMS_TEMPLATES.TEST_SUCCESS');
      },
      error: (err) => {
        tpl._testSending = false;
        this.notify.error(err);
      },
    });
  }

  saveAll(): void {
    if (this.dirty) this.saveNotifications();
    if (this.smsDirty) this.saveSmsTemplates();
  }

  private saveNotifications(): void {
    if (this.saving) return;
    this.saving = true;
    const settings: { targetGroup: string; event: string; channel: string; enabled: boolean }[] = [];

    for (const group of this.targetGroups) {
      for (const event of this.events) {
        const cell = this.matrix[group][event];
        settings.push({ targetGroup: group, event, channel: 'email', enabled: cell.email });
        settings.push({ targetGroup: group, event, channel: 'sms', enabled: cell.sms });
      }
    }

    this.api.put('/settings/notifications', { settings }).subscribe({
      next: () => {
        this.saving = false;
        this.dirty = false;
        this.notify.success('NOTIFICATION_SETTINGS.SAVE_SUCCESS');
      },
      error: (err) => {
        this.saving = false;
        this.notify.error(err);
      },
    });
  }

  private saveSmsTemplates(): void {
    if (this.smsSaving) return;
    this.smsSaving = true;

    const templates = this.smsTemplates.map((tpl) => ({
      event: tpl.event,
      targetGroup: tpl.targetGroup,
      template: tpl.template,
    }));

    this.api.put('/settings/sms-templates', { templates }).subscribe({
      next: () => {
        this.smsSaving = false;
        this.smsDirty = false;
        this.notify.success('NOTIFICATION_SETTINGS.SAVE_SUCCESS');
      },
      error: (err) => {
        this.smsSaving = false;
        this.notify.error(err);
      },
    });
  }

  // Keep old save() for backward compat
  save(): void {
    this.saveAll();
  }
}

interface SmsTemplateRow extends SmsTemplate {
  _preview: string;
  _testPhone: string;
  _testSending: boolean;
  _showTestInput: boolean;
}
