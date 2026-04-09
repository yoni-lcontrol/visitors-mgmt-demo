import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { HasPermissionDirective } from '../../../../core/permissions/has-permission.directive';
import { PermissionService } from '../../../../core/permissions/permission.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { CardTemplateApiService } from '../../services/card-template-api.service';
import { CardTemplate, CardTemplateElement } from '../models/card-template.model';
import { TranslateService } from '@ngx-translate/core';
import { WorkstationSessionService } from '../../../../core/services/workstation-session.service';
import QRCode from 'qrcode';

@Component({
    selector: 'app-card-template-list',
    standalone: true,
    imports: [TranslateModule, DatePipe, HasPermissionDirective, ConfirmDialogModule],
    providers: [ConfirmationService],
    changeDetection: ChangeDetectionStrategy.Default,
    template: `
        <div class="page-container">
            <div class="page-header">
                <div class="header-info">
                    <h1>{{ 'CARD_TEMPLATES.TITLE' | translate }}</h1>
                    <p class="subtitle">{{ 'CARD_TEMPLATES.DESCRIPTION' | translate }}</p>
                </div>
                <div class="header-actions" *hasPermission="'settings.card-templates.create'">
                    <button class="btn btn-primary" (click)="onCreate()">
                        <i class="pi pi-plus"></i>
                        {{ 'CARD_TEMPLATES.CREATE' | translate }}
                    </button>
                </div>
            </div>

            @if (loading) {
                <div class="loading-state">
                    <i class="pi pi-spin pi-spinner"></i>
                    <span>{{ 'COMMON.LOADING' | translate }}</span>
                </div>
            } @else if (templates.length === 0) {
                <div class="empty-state">
                    <i class="pi pi-id-card empty-icon"></i>
                    <h3>{{ 'CARD_TEMPLATES.EMPTY_TITLE' | translate }}</h3>
                    <p>{{ 'CARD_TEMPLATES.EMPTY_DESC' | translate }}</p>
                    <button class="btn btn-primary" *hasPermission="'settings.card-templates.create'" (click)="onCreate()">
                        <i class="pi pi-plus"></i>
                        {{ 'CARD_TEMPLATES.CREATE_FIRST' | translate }}
                    </button>
                </div>
            } @else {
                <div class="templates-grid">
                    @for (tpl of templates; track tpl.id) {
                        <div class="template-card">
                            <div class="card-preview" (click)="onPreview(tpl)">
                                <div class="mini-card" [style.background-color]="tpl.backgroundColor || '#ffffff'">
                                    <i class="pi pi-id-card preview-icon"></i>
                                </div>
                            </div>
                            <div class="card-info">
                                <h3 class="card-name">{{ tpl.name }}</h3>
                                <p class="card-desc">{{ tpl.description || ('CARD_TEMPLATES.NO_DESCRIPTION' | translate) }}</p>
                                <div class="card-meta">
                                    <span class="meta-item">
                                        <i class="pi pi-arrows-alt"></i>
                                        {{ tpl.cardWidthMm }}×{{ tpl.cardHeightMm }}mm
                                    </span>
                                    <span class="meta-item">
                                        <i class="pi pi-clock"></i>
                                        {{ tpl.updatedAt | date:'short' }}
                                    </span>
                                </div>
                            </div>
                            <div class="card-actions">
                                <button class="btn-icon" *hasPermission="'settings.card-templates.read'" (click)="onPreview(tpl)" title="{{ 'CARD_TEMPLATES.PREVIEW' | translate }}">
                                    <i class="pi pi-eye"></i>
                                </button>
                                <button class="btn-icon btn-print" *hasPermission="'visits.print-card'" (click)="onTestPrint(tpl)" [disabled]="printingTemplateId === tpl.id || !isPrinterAvailable()" [title]="'CARD_TEMPLATES.TEST_PRINT' | translate">
                                    <i class="pi" [class.pi-print]="printingTemplateId !== tpl.id" [class.pi-spin]="printingTemplateId === tpl.id" [class.pi-spinner]="printingTemplateId === tpl.id"></i>
                                </button>
                                <button class="btn-icon" *hasPermission="'settings.card-templates.update'" (click)="onEdit(tpl)" title="{{ 'COMMON.EDIT' | translate }}">
                                    <i class="pi pi-pencil"></i>
                                </button>
                                <button class="btn-icon btn-danger" *hasPermission="'settings.card-templates.delete'" (click)="onDelete(tpl)" title="{{ 'COMMON.DELETE' | translate }}">
                                    <i class="pi pi-trash"></i>
                                </button>
                            </div>
                        </div>
                    }
                </div>
            }

            <!-- Preview dialog -->
            @if (previewTemplate) {
                <div class="preview-overlay" (click)="closePreview()">
                    <div class="preview-dialog" (click)="$event.stopPropagation()">
                        <div class="preview-header">
                            <h2>{{ previewTemplate.name }}</h2>
                            <button class="btn-icon" (click)="closePreview()"><i class="pi pi-times"></i></button>
                        </div>
                        <div class="preview-body">
                            <div class="preview-card-container"
                                 [style.width.px]="getPreviewWidth(previewTemplate)"
                                 [style.height.px]="getPreviewHeight(previewTemplate)"
                                 [style.background-color]="previewTemplate.backgroundColor || '#ffffff'">
                                @for (el of getElements(previewTemplate); track el.id) {
                                    <div class="preview-element"
                                         [style.left.px]="el.x"
                                         [style.top.px]="el.y"
                                         [style.width.px]="el.width"
                                         [style.height.px]="el.height"
                                         [style.font-size.px]="el.fontSize || 14"
                                         [style.font-weight]="el.fontWeight || 'normal'"
                                         [style.text-align]="el.textAlign || 'left'"
                                         [style.color]="el.color || '#000000'">
                                        @if (el.type === 'visitor-field') {
                                            <span class="field-tag">{{ '{' + '{' + el.visitorField + '}' + '}' }}</span>
                                        } @else if (el.type === 'static-text') {
                                            {{ el.text }}
                                        } @else if (el.type === 'qr') {
                                            <img [src]="getQrDataUrl(el)" [style.width.px]="el.width" [style.height.px]="el.height" alt="QR" class="qr-preview-img" />
                                        }
                                    </div>
                                }
                            </div>
                        </div>
                    </div>
                </div>
            }

            <p-confirmDialog></p-confirmDialog>
        </div>
    `,
    styles: [`
        .page-container { padding: 1.5rem; }
        .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1.5rem;
            flex-wrap: wrap;
            gap: 1rem;
        }
        .header-info h1 {
            margin: 0 0 0.25rem;
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--color-primary, #020140);
        }
        .subtitle {
            margin: 0;
            color: var(--color-text-muted, #9896ad);
            font-size: 0.9rem;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.6rem 1.2rem;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
        }
        .btn-primary {
            background: var(--color-accent, #6c63ff);
            color: #fff;
        }
        .btn-primary:hover {
            background: var(--color-accent-hover, #5a52e0);
            transform: translateY(-1px);
        }
        .loading-state {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            padding: 4rem;
            color: var(--color-text-muted, #9896ad);
            font-size: 1rem;
        }
        .loading-state .pi-spinner { font-size: 1.5rem; }
        .empty-state {
            text-align: center;
            padding: 4rem 2rem;
            color: var(--color-text-muted, #9896ad);
        }
        .empty-icon {
            font-size: 3.5rem;
            margin-bottom: 1rem;
            opacity: 0.4;
        }
        .empty-state h3 {
            margin: 0 0 0.5rem;
            color: var(--color-text-primary, #333);
            font-size: 1.2rem;
        }
        .empty-state p {
            margin: 0 0 1.5rem;
            font-size: 0.9rem;
        }
        .templates-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 1.25rem;
        }
        .template-card {
            background: #fff;
            border-radius: 12px;
            border: 1.5px solid var(--color-border, #e4e2f0);
            overflow: hidden;
            transition: all 0.2s;
        }
        .template-card:hover {
            border-color: var(--color-accent, #6c63ff);
            box-shadow: 0 4px 16px rgba(108, 99, 255, 0.12);
        }
        .card-preview {
            padding: 1.5rem;
            display: flex;
            justify-content: center;
            background: var(--color-surface, #f9f9fc);
            cursor: pointer;
        }
        .mini-card {
            width: 172px;
            height: 108px;
            border-radius: 8px;
            border: 1px dashed var(--color-border, #ccc);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .preview-icon {
            font-size: 2rem;
            color: var(--color-text-muted, #bbb);
        }
        .card-info {
            padding: 1rem 1.25rem 0.5rem;
        }
        .card-name {
            margin: 0 0 0.25rem;
            font-size: 1rem;
            font-weight: 600;
            color: var(--color-text-primary, #333);
        }
        .card-desc {
            margin: 0 0 0.5rem;
            font-size: 0.82rem;
            color: var(--color-text-muted, #9896ad);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .card-meta {
            display: flex;
            gap: 1rem;
            font-size: 0.78rem;
            color: var(--color-text-muted, #9896ad);
        }
        .meta-item {
            display: flex;
            align-items: center;
            gap: 0.3rem;
        }
        .card-actions {
            display: flex;
            gap: 0.25rem;
            padding: 0.5rem 1.25rem 1rem;
        }
        .btn-icon {
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--color-border, #e4e2f0);
            background: transparent;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            color: var(--color-text-secondary, #666);
        }
        .btn-icon:hover {
            background: var(--color-primary-wash, #eeedf8);
            color: var(--color-accent, #6c63ff);
        }
        .btn-print:not(:disabled):hover {
            background: #e8f5e9;
            color: #2e7d32;
            border-color: #2e7d32;
        }
        .btn-print:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .btn-danger:hover {
            background: #fde8e8;
            color: #e53935;
            border-color: #e53935;
        }
        .preview-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .preview-dialog {
            background: #fff;
            border-radius: 12px;
            max-width: 90vw;
            max-height: 90vh;
            overflow: auto;
            box-shadow: 0 16px 48px rgba(0,0,0,0.2);
        }
        .preview-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 1.25rem;
            border-bottom: 1px solid var(--color-border, #e4e2f0);
        }
        .preview-header h2 {
            margin: 0;
            font-size: 1.1rem;
        }
        .preview-body {
            padding: 2rem;
            display: flex;
            justify-content: center;
        }
        .preview-card-container {
            position: relative;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }
        .preview-element {
            position: absolute;
            overflow: hidden;
            display: flex;
            align-items: center;
        }
        .field-tag {
            background: var(--color-primary-wash, #eeedf8);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.8em;
            color: var(--color-accent, #6c63ff);
        }
        .qr-preview-img {
            display: block;
            object-fit: contain;
        }
        @media (max-width: 640px) {
            .templates-grid { grid-template-columns: 1fr; }
        }
    `],
})
export class CardTemplateListComponent implements OnInit {
    private readonly api = inject(CardTemplateApiService);
    private readonly router = inject(Router);
    private readonly notification = inject(NotificationService);
    private readonly confirmationService = inject(ConfirmationService);
    private readonly translate = inject(TranslateService);
    private readonly workstationSession = inject(WorkstationSessionService);
    readonly permission = inject(PermissionService);

    templates: CardTemplate[] = [];
    loading = true;
    previewTemplate: CardTemplate | null = null;
    printingTemplateId: string | null = null;

    private readonly PX_PER_MM = 3.78; // ~96 DPI

    ngOnInit(): void {
        this.loadTemplates();
    }

    loadTemplates(): void {
        this.loading = true;
        this.api.getAll().subscribe({
            next: (data) => {
                this.templates = data;
                this.loading = false;
            },
            error: (err) => {
                this.notification.error(err);
                this.loading = false;
            },
        });
    }

    onCreate(): void {
        this.router.navigate(['/settings/card-templates/new']);
    }

    onEdit(tpl: CardTemplate): void {
        this.router.navigate(['/settings/card-templates', tpl.id, 'edit']);
    }

    onPreview(tpl: CardTemplate): void {
        this.previewTemplate = tpl;
    }

    closePreview(): void {
        this.previewTemplate = null;
    }

    onDelete(tpl: CardTemplate): void {
        this.confirmationService.confirm({
            message: this.translate.instant('CARD_TEMPLATES.DELETE_CONFIRM'),
            header: this.translate.instant('COMMON.CONFIRM'),
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.api.delete(tpl.id).subscribe({
                    next: () => {
                        this.notification.success('CARD_TEMPLATES.DELETE_SUCCESS');
                        this.loadTemplates();
                    },
                    error: (err) => this.notification.error(err),
                });
            },
        });
    }

    isPrinterAvailable(): boolean {
        return this.workstationSession.currentState.bound && this.workstationSession.isPrinterConnected();
    }

    onTestPrint(tpl: CardTemplate): void {
        if (this.printingTemplateId) return;

        if (!this.workstationSession.currentState.bound) {
            this.notification.warn(this.translate.instant('CARD_TEMPLATES.NO_WORKSTATION'));
            return;
        }

        this.printingTemplateId = tpl.id;
        this.api.testPrint(tpl.id).subscribe({
            next: () => {
                this.notification.success(this.translate.instant('CARD_TEMPLATES.TEST_PRINT_SENT'));
                this.printingTemplateId = null;
            },
            error: (err) => {
                this.notification.error(err);
                this.printingTemplateId = null;
            },
        });
    }

    getElements(tpl: CardTemplate): any[] {
        try {
            return JSON.parse(tpl.elementsJson);
        } catch {
            return [];
        }
    }

    getPreviewWidth(tpl: CardTemplate): number {
        return tpl.orientation === 'landscape'
            ? Math.max(tpl.cardHeightMm, tpl.cardWidthMm) * this.PX_PER_MM
            : Math.min(tpl.cardHeightMm, tpl.cardWidthMm) * this.PX_PER_MM;
    }

    getPreviewHeight(tpl: CardTemplate): number {
        return tpl.orientation === 'landscape'
            ? Math.min(tpl.cardHeightMm, tpl.cardWidthMm) * this.PX_PER_MM
            : Math.max(tpl.cardHeightMm, tpl.cardWidthMm) * this.PX_PER_MM;
    }

    private qrCache = new Map<string, string>();

    getQrDataUrl(el: CardTemplateElement): string {
        const content = el.qrSourceType === 'static'
            ? (el.qrStaticValue || 'QR')
            : `{{${el.qrDynamicField || 'personId'}}}`;
        const cacheKey = `${el.id}-${content}-${el.width}`;
        if (!this.qrCache.has(cacheKey)) {
            // Return placeholder immediately, generate async
            this.qrCache.set(cacheKey, '');
            QRCode.toDataURL(content, { width: el.width, margin: 1 }).then((url: string) => {
                this.qrCache.set(cacheKey, url);
            });
        }
        return this.qrCache.get(cacheKey) || '';
    }
}
