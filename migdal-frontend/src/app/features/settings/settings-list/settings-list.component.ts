import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '@core/api/api.service';
import { NotificationService } from '@core/notifications/notification.service';
import { HasPermissionDirective } from '@core/permissions/has-permission.directive';
import { Setting } from '@core/models/entities.model';
import { HasUnsavedChanges } from '@core/guards/unsaved-changes.guard';

@Component({
  selector: 'app-settings-list',
  standalone: true,
  imports: [FormsModule, TranslateModule, HasPermissionDirective],
  template: `
    <div class="page-header">
      <h1>{{ 'SETTINGS.TITLE' | translate }}</h1>
      <p class="page-subtitle">{{ 'SETTINGS.DESCRIPTION' | translate }}</p>
    </div>

    @if (loading) {
      <div class="loading-state">
        <i class="pi pi-spin pi-spinner"></i>
        <span>{{ 'COMMON.LOADING' | translate }}</span>
      </div>
    } @else {
      @for (group of groups; track group) {
        <div class="card settings-group">
          <h3 class="group-header">{{ translateGroup(group) }}</h3>
          <div class="settings-grid">
            @for (s of getByGroup(group); track s.id) {
              <div class="setting-row">
                <div class="setting-info">
                  <label>{{ translateLabel(s) }}</label>
                  <span class="setting-key">{{ s.key }}</span>
                  @if (s.description) { <p class="setting-desc">{{ translateDescription(s) }}</p> }
                </div>
                <div class="setting-value">
                  @if (s.type === 'boolean') {
                    <select [(ngModel)]="s.value" (ngModelChange)="onSettingChange()" [disabled]="saving" *hasPermission="'settings.update'">
                      <option value="true">{{ 'COMMON.YES' | translate }}</option>
                      <option value="false">{{ 'COMMON.NO' | translate }}</option>
                    </select>
                  } @else if (s.type === 'number') {
                    <input type="number" [(ngModel)]="s.value" (ngModelChange)="onSettingChange()" [disabled]="saving" *hasPermission="'settings.update'" [min]="isRetentionGroup(group) ? getRetentionMin(s) : null" [max]="isRetentionGroup(group) ? getRetentionMax(s) : null" [required]="isRetentionGroup(group)" [class.input-error]="isRetentionGroup(group) && isRetentionInvalid(s)" />
                    @if (isRetentionGroup(group) && isRetentionInvalid(s)) {
                      <span class="field-error">{{ getRetentionError(s) }}</span>
                    }
                  } @else {
                    <input type="text" [(ngModel)]="s.value" (ngModelChange)="onSettingChange()" [disabled]="saving" *hasPermission="'settings.update'" />
                  }
                  @if (s.isPublic) { <span class="public-tag">{{ 'SETTINGS.PUBLIC' | translate }}</span> }
                </div>
              </div>
            }
          </div>
        </div>
      }

      @if (groups.length === 0) {
        <div class="card empty-state">
          <p>{{ 'COMMON.NO_DATA' | translate }}</p>
        </div>
      }

      <div class="save-bar" [class.has-changes]="dirty">
        @if (dirty) {
          <span class="unsaved-hint">
            <i class="pi pi-exclamation-circle"></i>
            {{ 'SETTINGS.UNSAVED_CHANGES' | translate }}
          </span>
        }
        <button class="btn btn-primary save-btn" (click)="saveAll()" [disabled]="saving || !dirty || !valid">
          @if (saving) {
            <i class="pi pi-spin pi-spinner"></i>
            {{ 'SETTINGS.SAVING' | translate }}
          } @else {
            <i class="pi pi-save"></i>
            {{ 'COMMON.SAVE' | translate }}
          }
        </button>
      </div>
    }
  `,
  styles: [`
      :host { display: block; padding-bottom: 5rem; }

      .page-subtitle {
        color: var(--color-text-secondary, #5c5a78);
        font-size: 0.88rem;
        margin-top: 0.25rem;
      }

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

      .settings-group { margin-bottom: 1.75rem; }
      .group-header { margin: 0 0 1rem; font-size: 1rem; color: var(--color-primary, #020140); font-weight: 600; text-transform: capitalize; padding-bottom: 0.5rem; border-bottom: 2px solid var(--color-border, #e4e2f0); }
      .settings-grid { display: flex; flex-direction: column; gap: 0.75rem; }
      .setting-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 0.85rem 1rem; border-radius: var(--radius-md, 10px); background: var(--color-surface-alt, #f8f7fc); border: 1px solid var(--color-border-light, #eeedfa); transition: background 0.2s; }
      .setting-row:hover { background: var(--color-primary-wash, #eeedf8); }
      .setting-info { flex: 1; }
      .setting-info label { display: block; font-weight: 500; font-size: 0.9rem; margin-bottom: 0.15rem; color: var(--color-text, #1a1a2e); }
      .setting-key { font-size: 0.78rem; color: var(--color-text-muted, #9896ad); font-family: monospace; }
      .setting-desc { font-size: 0.82rem; color: var(--color-text-secondary, #5c5a78); margin: 0.25rem 0 0; }
      .setting-value { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
      .setting-value input, .setting-value select { padding: 0.4rem 0.6rem; border: 1.5px solid var(--color-border, #e4e2f0); border-radius: var(--radius-sm, 6px); font-size: 0.9rem; width: 180px; font-family: inherit; transition: border-color 0.2s, box-shadow 0.2s; }
      .setting-value input:focus, .setting-value select:focus { outline: none; border-color: var(--color-accent, #6c63ff); box-shadow: 0 0 0 3px rgba(108,99,255,0.12); }
      .setting-value input.input-error { border-color: var(--color-danger, #e74c3c); }
      .setting-value input.input-error:focus { box-shadow: 0 0 0 3px rgba(231,76,60,0.12); }
      .field-error { font-size: 0.75rem; color: var(--color-danger, #e74c3c); white-space: nowrap; }
      .public-tag { font-size: 0.7rem; padding: 0.1rem 0.35rem; background: var(--color-accent-subtle, #ddd9ff); color: var(--color-primary, #020140); border-radius: 4px; font-weight: 600; }
      .empty-state { text-align: center; color: var(--color-text-muted, #9896ad); padding: 2.5rem; font-style: italic; }

      /* ── Sticky save bar (matches Notifications pattern) ── */
      .save-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: var(--sidebar-width, 260px);
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

      @media (max-width: 959px) {
        .save-bar { right: 0; }
      }
      @media (max-width: 767px) {
        .setting-row { flex-direction: column; }
        .setting-value { width: 100%; }
        .setting-value input, .setting-value select { width: 100%; }
      }
    `],
})
export class SettingsListComponent implements OnInit, HasUnsavedChanges {
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  private translateService = inject(TranslateService);
  settings: Setting[] = [];
  groups: string[] = [];
  loading = true;
  saving = false;
  dirty = false;
  valid = true;
  private originals: Record<string, string> = {};

  ngOnInit(): void {
    this.loadSettings();
  }

  hasUnsavedChanges(): boolean {
    return this.dirty;
  }

  loadSettings(): void {
    this.loading = true;
    this.api.get<Setting[]>('/settings').subscribe({
      next: (s) => {
        this.settings = s;
        this.groups = [...new Set(s.map((x) => x.group))];
        this.snapshotAll();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  getByGroup(group: string): Setting[] {
    return this.settings.filter((s) => s.group === group);
  }

  isRetentionGroup(group: string): boolean {
    return group === 'retention';
  }

  onSettingChange(): void {
    this.dirty = this.settings.some(s => s.value !== this.originals[s.key]);
    this.valid = this.settings
      .filter(s => s.group === 'retention')
      .every(s => !this.isRetentionInvalid(s));
  }

  isRetentionInvalid(s: Setting): boolean {
    if (s.type === 'boolean') return false;
    const val = s.value?.toString().trim() ?? '';
    if (val === '') return true;
    const num = Number(val);
    const { min, max } = this.getRetentionRange(s);
    return !Number.isInteger(num) || num < min || num > max;
  }

  getRetentionError(s: Setting): string {
    const val = s.value?.toString().trim() ?? '';
    const { min, max } = this.getRetentionRange(s);
    if (val === '') return this.translateService.instant('VALIDATION.REQUIRED');
    const num = Number(val);
    if (num > max) return this.translateService.instant('VALIDATION.MAX', { max });
    if (num < min) return this.translateService.instant('VALIDATION.MIN', { min });
    return this.translateService.instant('VALIDATION.REQUIRED');
  }

  getRetentionMin(s: Setting): number {
    return this.getRetentionRange(s).min;
  }

  getRetentionMax(s: Setting): number {
    return this.getRetentionRange(s).max;
  }

  private getRetentionRange(_s: Setting): { min: number; max: number } {
    return { min: 1, max: 120 };
  }

  saveAll(): void {
    const changed = this.settings.filter(s => s.value !== this.originals[s.key]);
    if (changed.length === 0) return;

    this.saving = true;
    let completed = 0;
    let hadError = false;
    for (const s of changed) {
      this.api.patch(`/settings/${s.key}`, { value: s.value }).subscribe({
        next: () => {
          completed++;
          if (completed === changed.length) {
            this.saving = false;
            if (!hadError) {
              this.dirty = false;
              this.snapshotAll();
              this.notify.success('SETTINGS.SAVE_SUCCESS');
            }
          }
        },
        error: (err) => {
          hadError = true;
          completed++;
          if (completed === changed.length) {
            this.saving = false;
          }
          this.notify.error(err);
        },
      });
    }
  }

  translateGroup(group: string): string {
    const key = 'SETTINGS.GROUPS.' + group;
    const translated = this.translateService.instant(key);
    return translated !== key ? translated : group;
  }

  translateLabel(s: Setting): string {
    const key = 'SETTINGS.LABELS.' + s.key;
    const translated = this.translateService.instant(key);
    return translated !== key ? translated : s.label;
  }

  translateDescription(s: Setting): string {
    const key = 'SETTINGS.DESCRIPTIONS.' + s.key;
    const translated = this.translateService.instant(key);
    return translated !== key ? translated : (s.description || '');
  }

  private snapshotAll(): void {
    this.originals = {};
    this.settings.forEach(s => this.originals[s.key] = s.value);
    this.dirty = false;
  }
}
