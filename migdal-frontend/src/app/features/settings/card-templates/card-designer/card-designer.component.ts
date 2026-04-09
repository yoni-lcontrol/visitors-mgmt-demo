import {
    Component,
    inject,
    OnInit,
    OnDestroy,
    AfterViewInit,
    ElementRef,
    ViewChild,
    ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { CardTemplateApiService } from '../../services/card-template-api.service';
import {
    CardTemplate,
    CardTemplateElement,
    VISITOR_FIELDS,
} from '../models/card-template.model';
import { WorkstationSessionService } from '../../../../core/services/workstation-session.service';
import Konva from 'konva';
import QRCode from 'qrcode';

@Component({
    selector: 'app-card-designer',
    standalone: true,
    imports: [FormsModule, ReactiveFormsModule, TranslateModule],
    changeDetection: ChangeDetectionStrategy.Default,
    template: `
        <div class="designer-container">
            <!-- Top toolbar -->
            <div class="designer-toolbar">
                <button class="btn btn-back" (click)="goBack()">
                    <i class="pi pi-arrow-left"></i>
                    {{ 'COMMON.BACK' | translate }}
                </button>
                <div class="toolbar-title">
                    <input
                        class="template-name-input"
                        [class.input-error]="nameInvalid"
                        [(ngModel)]="templateName"
                        (ngModelChange)="nameInvalid = false"
                        [placeholder]="'CARD_TEMPLATES.TEMPLATE_NAME_PLACEHOLDER' | translate"
                    />
                </div>
                <div class="toolbar-actions">
                    <button class="btn btn-secondary" (click)="onPreview()">
                        <i class="pi pi-eye"></i>
                        {{ 'CARD_TEMPLATES.PREVIEW' | translate }}
                    </button>
                    <button class="btn btn-print-test" (click)="onTestPrint()" [disabled]="testPrinting || !canTestPrint()" [title]="getTestPrintTooltip()">
                        <i class="pi" [class.pi-print]="!testPrinting" [class.pi-spin]="testPrinting" [class.pi-spinner]="testPrinting"></i>
                        {{ testPrinting ? ('COMMON.SENDING' | translate) : ('CARD_TEMPLATES.TEST_PRINT' | translate) }}
                    </button>
                    <button class="btn btn-primary" (click)="onSave()" [disabled]="saving">
                        <i class="pi pi-save"></i>
                        {{ saving ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
                    </button>
                </div>
            </div>

            <div class="designer-body">
                <!-- Left sidebar: field palette -->
                <div class="palette-panel">
                    <h3 class="panel-title">{{ 'CARD_TEMPLATES.VISITOR_FIELDS' | translate }}</h3>
                    <p class="panel-hint">{{ 'CARD_TEMPLATES.DRAG_HINT' | translate }}</p>
                    <div class="field-list">
                        @for (field of visitorFields; track field.key) {
                            <div class="palette-field" (click)="addVisitorField(field.key, field.label)">
                                <i class="pi pi-plus-circle"></i>
                                <span>{{ field.label }}</span>
                            </div>
                        }
                    </div>
                    <div class="palette-divider"></div>
                    <h3 class="panel-title">{{ 'CARD_TEMPLATES.OTHER_ELEMENTS' | translate }}</h3>
                    <div class="field-list">
                        <div class="palette-field" (click)="addStaticText()">
                            <i class="pi pi-align-left"></i>
                            <span>{{ 'CARD_TEMPLATES.STATIC_TEXT' | translate }}</span>
                        </div>
                        <div class="palette-field" (click)="addShape()">
                            <i class="pi pi-stop"></i>
                            <span>{{ 'CARD_TEMPLATES.SHAPE' | translate }}</span>
                        </div>
                        <div class="palette-field" (click)="addQrElement()">
                            <i class="pi pi-qrcode"></i>
                            <span>{{ 'CARD_TEMPLATES.QR_CODE' | translate }}</span>
                        </div>
                    </div>
                </div>

                <!-- Center: canvas area -->
                <div class="canvas-area">
                    <div class="canvas-wrapper">
                        <div #konvaContainer class="konva-container"></div>
                    </div>
                    <div class="canvas-info">
                        {{ templateOrientation }} · {{ templateWidthMm }}×{{ templateHeightMm }}mm
                        · {{ elements.length }} {{ 'CARD_TEMPLATES.ELEMENTS' | translate }}
                    </div>
                </div>

                <!-- Right sidebar: element properties -->
                <div class="properties-panel">
                    @if (selectedElement) {
                        <h3 class="panel-title">{{ 'CARD_TEMPLATES.ELEMENT_PROPERTIES' | translate }}</h3>
                        <div class="prop-group">
                            <label>{{ 'CARD_TEMPLATES.PROP_TYPE' | translate }}</label>
                            <div class="prop-value-static">{{ selectedElement.type }}</div>
                        </div>
                        @if (selectedElement.type === 'visitor-field') {
                            <div class="prop-group">
                                <label>{{ 'CARD_TEMPLATES.PROP_FIELD' | translate }}</label>
                                <select [(ngModel)]="selectedElement.visitorField" (ngModelChange)="updateElementOnCanvas()">
                                    @for (f of visitorFields; track f.key) {
                                        <option [value]="f.key">{{ f.label }}</option>
                                    }
                                </select>
                            </div>
                        }
                        @if (selectedElement.type === 'static-text') {
                            <div class="prop-group">
                                <label>{{ 'CARD_TEMPLATES.PROP_TEXT' | translate }}</label>
                                <input [(ngModel)]="selectedElement.text" (ngModelChange)="updateElementOnCanvas()" />
                            </div>
                        }
                        @if (selectedElement.type === 'qr') {
                            <div class="prop-group">
                                <label>{{ 'CARD_TEMPLATES.QR_SOURCE_TYPE' | translate }}</label>
                                <select [(ngModel)]="selectedElement.qrSourceType" (ngModelChange)="onQrSourceTypeChange()">
                                    <option value="dynamic">{{ 'CARD_TEMPLATES.QR_DYNAMIC' | translate }}</option>
                                    <option value="static">{{ 'CARD_TEMPLATES.QR_STATIC' | translate }}</option>
                                </select>
                            </div>
                            @if (selectedElement.qrSourceType === 'dynamic') {
                                <div class="prop-group">
                                    <label>{{ 'CARD_TEMPLATES.QR_DYNAMIC_FIELD' | translate }}</label>
                                    <select [(ngModel)]="selectedElement.qrDynamicField" (ngModelChange)="updateElementOnCanvas()">
                                        @for (f of visitorFields; track f.key) {
                                            <option [value]="f.key">{{ f.label }}</option>
                                        }
                                    </select>
                                </div>
                            }
                            @if (selectedElement.qrSourceType === 'static') {
                                <div class="prop-group">
                                    <label>{{ 'CARD_TEMPLATES.QR_STATIC_VALUE' | translate }}</label>
                                    <input [(ngModel)]="selectedElement.qrStaticValue" (ngModelChange)="updateElementOnCanvas()" />
                                </div>
                            }
                        }
                        <div class="prop-row">
                            <div class="prop-group half">
                                <label>X</label>
                                <input type="number" [(ngModel)]="selectedElement.x" (ngModelChange)="updateElementOnCanvas()" />
                            </div>
                            <div class="prop-group half">
                                <label>Y</label>
                                <input type="number" [(ngModel)]="selectedElement.y" (ngModelChange)="updateElementOnCanvas()" />
                            </div>
                        </div>
                        <div class="prop-row">
                            <div class="prop-group half">
                                <label>{{ 'CARD_TEMPLATES.PROP_WIDTH' | translate }}</label>
                                <input type="number" [(ngModel)]="selectedElement.width" (ngModelChange)="updateElementOnCanvas()" />
                            </div>
                            <div class="prop-group half">
                                <label>{{ 'CARD_TEMPLATES.PROP_HEIGHT' | translate }}</label>
                                <input type="number" [(ngModel)]="selectedElement.height" (ngModelChange)="updateElementOnCanvas()" />
                            </div>
                        </div>
                        @if (selectedElement.type !== 'qr' && selectedElement.type !== 'shape') {
                        <div class="prop-group">
                            <label>{{ 'CARD_TEMPLATES.PROP_FONT_SIZE' | translate }}</label>
                            <input type="number" [(ngModel)]="selectedElement.fontSize" (ngModelChange)="updateElementOnCanvas()" />
                        </div>
                        <div class="prop-group">
                            <label>{{ 'CARD_TEMPLATES.PROP_FONT_WEIGHT' | translate }}</label>
                            <select [(ngModel)]="selectedElement.fontWeight" (ngModelChange)="updateElementOnCanvas()">
                                <option value="normal">Normal</option>
                                <option value="bold">Bold</option>
                            </select>
                        </div>
                        <div class="prop-group">
                            <label>{{ 'CARD_TEMPLATES.PROP_TEXT_ALIGN' | translate }}</label>
                            <select [(ngModel)]="selectedElement.textAlign" (ngModelChange)="updateElementOnCanvas()">
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                            </select>
                        </div>
                        <div class="prop-group">
                            <label>{{ 'CARD_TEMPLATES.PROP_COLOR' | translate }}</label>
                            <input type="color" [(ngModel)]="selectedElement.color" (ngModelChange)="updateElementOnCanvas()" />
                        </div>
                        }
                        <div class="prop-group">
                            <label>{{ 'CARD_TEMPLATES.PROP_BG_COLOR' | translate }}</label>
                            <input type="color" [(ngModel)]="selectedElement.backgroundColor" (ngModelChange)="updateElementOnCanvas()" />
                        </div>
                        <button class="btn btn-danger-sm" (click)="removeSelectedElement()">
                            <i class="pi pi-trash"></i>
                            {{ 'CARD_TEMPLATES.DELETE_ELEMENT' | translate }}
                        </button>
                    } @else {
                        <div class="no-selection">
                            <i class="pi pi-info-circle"></i>
                            <p>{{ 'CARD_TEMPLATES.SELECT_ELEMENT_HINT' | translate }}</p>
                        </div>
                    }

                    <div class="card-settings-section">
                        <h3 class="panel-title">{{ 'CARD_TEMPLATES.CARD_SETTINGS' | translate }}</h3>
                        <div class="prop-group">
                            <label>{{ 'CARD_TEMPLATES.ORIENTATION' | translate }}</label>
                            <select [(ngModel)]="templateOrientation" (ngModelChange)="onOrientationChange()">
                                <option value="landscape">{{ 'CARD_TEMPLATES.LANDSCAPE' | translate }}</option>
                                <option value="portrait">{{ 'CARD_TEMPLATES.PORTRAIT' | translate }}</option>
                            </select>
                        </div>
                        <div class="prop-group">
                            <label>{{ 'CARD_TEMPLATES.PROP_BG_COLOR' | translate }}</label>
                            <input type="color" [(ngModel)]="cardBackgroundColor" (ngModelChange)="updateCardBackground()" />
                        </div>
                    </div>
                </div>
            </div>

            @if (showPreview) {
                <div class="preview-overlay" (click)="closePreview()">
                    <div class="preview-dialog" (click)="$event.stopPropagation()">
                        <div class="preview-header">
                            <h2>{{ templateName || ('CARD_TEMPLATES.PREVIEW' | translate) }}</h2>
                            <button class="btn-icon" (click)="closePreview()"><i class="pi pi-times"></i></button>
                        </div>
                        <div class="preview-body">
                            <div class="preview-card"
                                 [style.width.px]="canvasWidth"
                                 [style.height.px]="canvasHeight"
                                 [style.background-color]="cardBackgroundColor">
                                @for (el of elements; track el.id) {
                                    @if (el.visible !== false) {
                                        <div class="preview-el"
                                             [style.left.px]="el.x"
                                             [style.top.px]="el.y"
                                             [style.width.px]="el.width"
                                             [style.height.px]="el.height"
                                             [style.font-size.px]="el.fontSize || 14"
                                             [style.font-weight]="el.fontWeight || 'normal'"
                                             [style.text-align]="el.textAlign || 'left'"
                                             [style.color]="el.color || '#000000'"
                                             [style.background-color]="el.backgroundColor || 'transparent'">
                                            @if (el.type === 'visitor-field') {
                                                {{ previewSampleData[el.visitorField || ''] || el.visitorField }}
                                            } @else if (el.type === 'static-text') {
                                                {{ el.text }}
                                            } @else if (el.type === 'qr') {
                                                <img [src]="getPreviewQrUrl(el)" [style.width.px]="el.width" [style.height.px]="el.height" alt="QR" class="preview-qr-img" />
                                            } @else if (el.type === 'shape') {
                                                &nbsp;
                                            }
                                        </div>
                                    }
                                }
                            </div>
                        </div>
                    </div>
                </div>
            }
        </div>
    `,
    styles: [`
        .designer-container {
            display: flex;
            flex-direction: column;
            height: calc(94vh - var(--header-height, 62px));
            background: #f4f3f9;
        }
        .designer-toolbar {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.6rem 1.25rem;
            background: #fff;
            border-bottom: 1px solid var(--color-border, #e4e2f0);
            z-index: 10;
        }
        .toolbar-title {
            flex: 1;
            display: flex;
            justify-content: center;
        }
        .template-name-input {
            border: 1px solid var(--color-border, #e4e2f0);
            background: #fff;
            font-size: 1.1rem;
            font-weight: 600;
            padding: 0.4rem 0.75rem;
            border-radius: 6px;
            font-family: inherit;
            color: var(--color-text-primary, #333);
            min-width: 260px;
            text-align: center;
        }
        .template-name-input:focus {
            outline: none;
            border-color: var(--color-accent, #6c63ff);
            box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.12);
        }
        .template-name-input.input-error {
            border-color: #e53935;
            box-shadow: 0 0 0 2px rgba(229, 57, 53, 0.15);
        }
        .template-name-input.input-error::placeholder {
            color: #e53935;
        }
        .toolbar-actions {
            display: flex;
            gap: 0.5rem;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
        }
        .btn-primary { background: var(--color-accent, #6c63ff); color: #fff; }
        .btn-primary:hover:not(:disabled) { background: var(--color-accent-hover, #5a52e0); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: var(--color-surface, #fff); color: var(--color-text-primary, #333); border: 1px solid var(--color-border, #e4e2f0); }
        .btn-secondary:hover { background: var(--color-primary-wash, #eeedf8); }
        .btn-print-test { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
        .btn-print-test:hover:not(:disabled) { background: #c8e6c9; }
        .btn-print-test:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-back { background: transparent; color: var(--color-text-secondary, #666); }
        .btn-back:hover { color: var(--color-accent, #6c63ff); }
        .btn-danger-sm {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.4rem;
            padding: 0.5rem;
            border: 1px solid #e53935;
            background: #fde8e8;
            color: #e53935;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.82rem;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 1rem;
            font-family: inherit;
        }
        .btn-danger-sm:hover { background: #e53935; color: #fff; }
        .designer-body {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        .palette-panel, .properties-panel {
            width: 240px;
            min-width: 240px;
            background: #fff;
            border-inline-end: 1px solid var(--color-border, #e4e2f0);
            padding: 1rem;
            overflow-y: auto;
        }
        .properties-panel {
            border-inline-end: none;
            border-inline-start: 1px solid var(--color-border, #e4e2f0);
        }
        .panel-title {
            font-size: 0.82rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--color-text-muted, #9896ad);
            margin: 0 0 0.6rem;
        }
        .panel-hint {
            font-size: 0.78rem;
            color: var(--color-text-muted, #bbb);
            margin: 0 0 0.75rem;
        }
        .field-list {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        .palette-field {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.45rem 0.6rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            color: var(--color-text-secondary, #555);
            transition: all 0.15s;
        }
        .palette-field:hover {
            background: var(--color-primary-wash, #eeedf8);
            color: var(--color-accent, #6c63ff);
        }
        .palette-field i { font-size: 0.85rem; }
        .palette-divider {
            height: 1px;
            background: var(--color-border, #e4e2f0);
            margin: 1rem 0;
        }
        .canvas-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            overflow: auto;
        }
        .canvas-wrapper {
            background: #e8e7ee;
            border-radius: 8px;
            padding: 24px;
            box-shadow: inset 0 2px 8px rgba(0,0,0,0.06);
        }
        .konva-container {
            border-radius: 6px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .canvas-info {
            margin-top: 0.75rem;
            font-size: 0.78rem;
            color: var(--color-text-muted, #9896ad);
        }
        .prop-group {
            margin-bottom: 0.75rem;
        }
        .prop-group label {
            display: block;
            font-size: 0.78rem;
            font-weight: 600;
            color: var(--color-text-secondary, #666);
            margin-bottom: 0.2rem;
        }
        .prop-group input, .prop-group select {
            width: 100%;
            padding: 0.4rem 0.6rem;
            border: 1px solid var(--color-border, #e4e2f0);
            border-radius: 6px;
            font-size: 0.85rem;
            font-family: inherit;
            box-sizing: border-box;
        }
        .prop-group input:focus, .prop-group select:focus {
            outline: none;
            border-color: var(--color-accent, #6c63ff);
        }
        .prop-group input[type="color"] {
            height: 34px;
            padding: 2px;
            cursor: pointer;
        }
        .prop-value-static {
            font-size: 0.85rem;
            color: var(--color-text-muted, #9896ad);
            padding: 0.3rem 0;
            text-transform: capitalize;
        }
        .prop-row {
            display: flex;
            gap: 0.5rem;
        }
        .prop-row .half { flex: 1; }
        .no-selection {
            text-align: center;
            padding: 2rem 0.5rem;
            color: var(--color-text-muted, #bbb);
        }
        .no-selection i { font-size: 1.5rem; margin-bottom: 0.5rem; display: block; }
        .no-selection p { font-size: 0.82rem; margin: 0; }
        .card-settings-section {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid var(--color-border, #e4e2f0);
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
        .preview-header h2 { margin: 0; font-size: 1.1rem; }
        .preview-body {
            padding: 2rem;
            display: flex;
            justify-content: center;
        }
        .preview-card {
            position: relative;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }
        .preview-el {
            position: absolute;
            overflow: hidden;
            display: flex;
            align-items: center;
        }
        .preview-qr-img {
            display: block;
            object-fit: contain;
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
    `],
})
export class CardDesignerComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('konvaContainer', { static: false }) konvaContainer!: ElementRef<HTMLDivElement>;

    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly api = inject(CardTemplateApiService);
    private readonly notification = inject(NotificationService);
    private readonly translate = inject(TranslateService);
    private readonly workstationSession = inject(WorkstationSessionService);

    visitorFields = VISITOR_FIELDS;
    templateName = '';
    templateDescription = '';
    templateOrientation = 'landscape';
    templateWidthMm = 86;
    templateHeightMm = 54;
    cardBackgroundColor = '#ffffff';
    elements: CardTemplateElement[] = [];
    selectedElement: CardTemplateElement | null = null;
    saving = false;
    showPreview = false;
    nameInvalid = false;
    testPrinting = false;
    templateId: string | null = null;

    readonly previewSampleData: Record<string, string> = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        personId: '123456789',
        phone: '+972501234567',
        email: 'john@example.com',
        hostName: 'Jane Smith',
        visitDate: '2026-03-30',
        startTime: '09:00',
        endTime: '17:00',
        visitorImage: 'visitor-image',
        carNumber: '12-345-67',
    };

    private stage!: Konva.Stage;
    private layer!: Konva.Layer;
    private guideLayer!: Konva.Layer;
    private transformer!: Konva.Transformer;
    private readonly PX_PER_MM = 3.78;
    private nextElementId = 1;

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (id && id !== 'new') {
            this.templateId = id;
        }
    }

    ngAfterViewInit(): void {
        this.initStage();
        if (this.templateId) {
            this.loadTemplate();
        }
    }

    ngOnDestroy(): void {
        this.stage?.destroy();
    }

    get canvasWidth(): number {
        return (this.templateOrientation === 'landscape'
            ? Math.max(this.templateWidthMm, this.templateHeightMm)
            : Math.min(this.templateWidthMm, this.templateHeightMm)) * this.PX_PER_MM;
    }

    get canvasHeight(): number {
        return (this.templateOrientation === 'landscape'
            ? Math.min(this.templateWidthMm, this.templateHeightMm)
            : Math.max(this.templateWidthMm, this.templateHeightMm)) * this.PX_PER_MM;
    }

    private initStage(): void {
        const w = this.canvasWidth;
        const h = this.canvasHeight;

        this.stage = new Konva.Stage({
            container: this.konvaContainer.nativeElement,
            width: w,
            height: h,
        });

        // Background layer
        const bgLayer = new Konva.Layer();
        const bgRect = new Konva.Rect({
            x: 0, y: 0, width: w, height: h,
            fill: this.cardBackgroundColor,
            listening: false,
        });
        bgRect.name('background');
        bgLayer.add(bgRect);
        this.stage.add(bgLayer);

        // Guide layer for snapping
        this.guideLayer = new Konva.Layer();
        this.stage.add(this.guideLayer);

        // Main element layer
        this.layer = new Konva.Layer();
        this.stage.add(this.layer);

        // Transformer for selection
        this.transformer = new Konva.Transformer({
            rotateEnabled: false,
            boundBoxFunc: (oldBox, newBox) => {
                if (newBox.width < 20 || newBox.height < 15) return oldBox;
                return newBox;
            },
        });
        this.layer.add(this.transformer);

        // Click on empty space deselects
        this.stage.on('click tap', (e) => {
            if (e.target === this.stage || e.target.name() === 'background') {
                this.deselectAll();
            }
        });
    }

    private loadTemplate(): void {
        this.api.getById(this.templateId!).subscribe({
            next: (tpl) => {
                this.templateName = tpl.name;
                this.templateDescription = tpl.description || '';
                this.templateOrientation = tpl.orientation;
                this.templateWidthMm = tpl.cardWidthMm;
                this.templateHeightMm = tpl.cardHeightMm;
                this.cardBackgroundColor = tpl.backgroundColor || '#ffffff';

                this.resizeStage();
                this.updateCardBackground();

                try {
                    const els = JSON.parse(tpl.elementsJson) as CardTemplateElement[];
                    els.forEach((el) => {
                        this.elements.push(el);
                        this.addElementToCanvas(el);
                        const numId = parseInt(el.id.replace('el-', ''), 10);
                        if (numId >= this.nextElementId) this.nextElementId = numId + 1;
                    });
                } catch { /* ignore malformed data */ }
            },
            error: (err) => {
                this.notification.error(err);
                this.router.navigate(['/settings/card-templates']);
            },
        });
    }

    addVisitorField(fieldKey: string, fieldLabel: string): void {
        // Calculate width to fit placeholder text {{fieldKey}} at default font size
        const placeholderLength = fieldKey.length + 4; // +4 for {{ }}
        const estimatedWidth = Math.max(150, placeholderLength * 9);
        const el: CardTemplateElement = {
            id: `el-${this.nextElementId++}`,
            type: 'visitor-field',
            visitorField: fieldKey,
            label: fieldLabel,
            x: 20,
            y: 20,
            width: estimatedWidth,
            height: 28,
            fontSize: 14,
            fontWeight: 'normal',
            textAlign: 'left',
            color: '#000000',
            backgroundColor: 'transparent',
            visible: true,
            zIndex: this.elements.length,
        };
        this.elements.push(el);
        this.addElementToCanvas(el);
        this.selectElement(el.id);
    }

    addStaticText(): void {
        const el: CardTemplateElement = {
            id: `el-${this.nextElementId++}`,
            type: 'static-text',
            text: 'Text',
            x: 20,
            y: 20,
            width: 120,
            height: 28,
            fontSize: 14,
            fontWeight: 'normal',
            textAlign: 'left',
            color: '#000000',
            backgroundColor: 'transparent',
            visible: true,
            zIndex: this.elements.length,
        };
        this.elements.push(el);
        this.addElementToCanvas(el);
        this.selectElement(el.id);
    }

    addShape(): void {
        const el: CardTemplateElement = {
            id: `el-${this.nextElementId++}`,
            type: 'shape',
            x: 20,
            y: 20,
            width: 100,
            height: 60,
            color: 'transparent',
            backgroundColor: '#e4e2f0',
            visible: true,
            zIndex: this.elements.length,
        };
        this.elements.push(el);
        this.addElementToCanvas(el);
        this.selectElement(el.id);
    }

    addQrElement(): void {
        const el: CardTemplateElement = {
            id: `el-${this.nextElementId++}`,
            type: 'qr',
            x: 20,
            y: 20,
            width: 80,
            height: 80,
            backgroundColor: '#ffffff',
            visible: true,
            zIndex: this.elements.length,
            qrSourceType: 'dynamic',
            qrDynamicField: 'personId',
        };
        this.elements.push(el);
        this.addElementToCanvas(el);
        this.selectElement(el.id);
    }

    onQrSourceTypeChange(): void {
        if (!this.selectedElement || this.selectedElement.type !== 'qr') return;
        if (this.selectedElement.qrSourceType === 'dynamic') {
            this.selectedElement.qrDynamicField = this.selectedElement.qrDynamicField || 'personId';
            this.selectedElement.qrStaticValue = undefined;
        } else {
            this.selectedElement.qrStaticValue = this.selectedElement.qrStaticValue || '';
            this.selectedElement.qrDynamicField = undefined;
        }
        this.updateElementOnCanvas();
    }

    private addElementToCanvas(el: CardTemplateElement): void {
        const group = new Konva.Group({
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            draggable: true,
            id: el.id,
        });

        // Background rect
        const bgRect = new Konva.Rect({
            width: el.width,
            height: el.height,
            fill: el.backgroundColor || 'transparent',
            stroke: el.type === 'shape' ? (el.borderColor || '#ccc') : 'transparent',
            strokeWidth: el.type === 'shape' ? (el.borderWidth || 1) : 0,
            cornerRadius: 2,
        });
        bgRect.name('element-bg');
        group.add(bgRect);

        // Text content
        if (el.type !== 'shape' && el.type !== 'qr') {
            const displayText = el.type === 'visitor-field'
                ? `{{${el.visitorField}}}`
                : (el.text || '');
            const textNode = new Konva.Text({
                text: displayText,
                width: el.width,
                height: el.height,
                fontSize: el.fontSize || 14,
                fontStyle: el.fontWeight === 'bold' ? 'bold' : 'normal',
                align: el.textAlign || 'left',
                verticalAlign: 'middle',
                fill: el.color || '#000000',
                padding: 4,
                wrap: 'none',
            });
            textNode.name('element-text');
            group.add(textNode);
        }

        // QR code rendering
        if (el.type === 'qr') {
            this.renderQrOnGroup(group, el);
        }

        // Selection indicator
        const selectBorder = new Konva.Rect({
            width: el.width,
            height: el.height,
            stroke: '#6c63ff',
            strokeWidth: 2,
            visible: false,
            dash: [4, 2],
        });
        selectBorder.name('select-border');
        group.add(selectBorder);

        // Click to select
        group.on('click tap', () => {
            this.selectElement(el.id);
        });

        // Drag events with snapping
        group.on('dragmove', () => {
            this.handleSnapping(group);
        });

        group.on('dragend', () => {
            // Update element position
            el.x = Math.round(group.x());
            el.y = Math.round(group.y());
            this.clearGuides();
        });

        // Transform events
        group.on('transformend', () => {
            const scaleX = group.scaleX();
            const scaleY = group.scaleY();
            el.width = Math.round(group.width() * scaleX);
            el.height = Math.round(group.height() * scaleY);
            el.x = Math.round(group.x());
            el.y = Math.round(group.y());
            group.scaleX(1);
            group.scaleY(1);
            // Resize children
            group.find('.element-bg').forEach((n: any) => {
                n.width(el.width);
                n.height(el.height);
            });
            group.find('.element-text').forEach((n: any) => {
                n.width(el.width);
                n.height(el.height);
            });
            group.find('.qr-image').forEach((n: any) => {
                n.width(el.width);
                n.height(el.height);
            });
            group.find('.select-border').forEach((n: any) => {
                n.width(el.width);
                n.height(el.height);
            });
            group.width(el.width);
            group.height(el.height);
        });

        this.layer.add(group);
        this.layer.draw();
    }

    selectElement(id: string): void {
        this.deselectAll();
        const el = this.elements.find((e) => e.id === id);
        if (!el) return;
        this.selectedElement = el;

        const group = this.layer.findOne(`#${id}`) as Konva.Group;
        if (group) {
            group.find('.select-border').forEach((n: any) => n.visible(true));
            this.transformer.nodes([group]);
            this.layer.draw();
        }
    }

    deselectAll(): void {
        this.selectedElement = null;
        this.transformer.nodes([]);
        this.layer.find('.select-border').forEach((n: any) => n.visible(false));
        this.layer.draw();
    }

    removeSelectedElement(): void {
        if (!this.selectedElement) return;
        const id = this.selectedElement.id;
        this.elements = this.elements.filter((e) => e.id !== id);
        const group = this.layer.findOne(`#${id}`);
        if (group) {
            group.destroy();
        }
        this.transformer.nodes([]);
        this.selectedElement = null;
        this.layer.draw();
    }

    updateElementOnCanvas(): void {
        if (!this.selectedElement) return;
        const el = this.selectedElement;
        const group = this.layer.findOne(`#${el.id}`) as Konva.Group;
        if (!group) return;

        group.x(el.x);
        group.y(el.y);
        group.width(el.width);
        group.height(el.height);

        group.find('.element-bg').forEach((n: any) => {
            n.width(el.width);
            n.height(el.height);
            n.fill(el.backgroundColor || 'transparent');
        });

        group.find('.element-text').forEach((n: any) => {
            n.width(el.width);
            n.height(el.height);
            n.fontSize(el.fontSize || 14);
            n.fontStyle(el.fontWeight === 'bold' ? 'bold' : 'normal');
            n.align(el.textAlign || 'left');
            n.fill(el.color || '#000000');
            n.wrap('none');
            const displayText = el.type === 'visitor-field'
                ? `{{${el.visitorField}}}`
                : (el.text || '');
            n.text(displayText);
        });

        // Re-render QR when source changes
        if (el.type === 'qr') {
            this.renderQrOnGroup(group, el);
        }

        group.find('.select-border').forEach((n: any) => {
            n.width(el.width);
            n.height(el.height);
        });

        this.layer.draw();
    }

    private renderQrOnGroup(group: Konva.Group, el: CardTemplateElement): void {
        // Remove previous QR image
        group.find('.qr-image').forEach((n: any) => n.destroy());

        const qrContent = this.getQrContentForDesigner(el);
        QRCode.toDataURL(qrContent, {
            width: el.width,
            margin: 1,
            color: { dark: '#000000', light: el.backgroundColor || '#ffffff' },
        }).then((dataUrl: string) => {
            const img = new Image();
            img.onload = () => {
                const konvaImg = new Konva.Image({
                    image: img,
                    width: el.width,
                    height: el.height,
                });
                konvaImg.name('qr-image');
                // Insert before select-border
                const selectBorder = group.findOne('.select-border');
                if (selectBorder) {
                    konvaImg.moveTo(group);
                    konvaImg.moveToBottom();
                    // Move above bg rect
                    konvaImg.moveUp();
                }
                this.layer.draw();
            };
            img.src = dataUrl;
        });
    }

    private getQrContentForDesigner(el: CardTemplateElement): string {
        if (el.qrSourceType === 'static') {
            return el.qrStaticValue || 'QR';
        }
        // Dynamic: show sample placeholder
        const field = el.qrDynamicField || 'personId';
        const sampleData: Record<string, string> = {
            firstName: 'John',
            lastName: 'Doe',
            fullName: 'John Doe',
            personId: '123456789',
            phone: '+972501234567',
            email: 'john@example.com',
            hostName: 'Jane Smith',
            visitDate: '2026-03-30',
            startTime: '09:00',
            endTime: '17:00',
            visitorImage: 'visitor-image',
            carNumber: '12-345-67',
        };
        return sampleData[field] || `{{${field}}}`;
    }

    onOrientationChange(): void {
        this.resizeStage();
    }

    updateCardBackground(): void {
        const bgLayer = this.stage.children?.[0] as Konva.Layer;
        if (bgLayer) {
            bgLayer.find('.background').forEach((n: any) => {
                n.fill(this.cardBackgroundColor);
                n.width(this.canvasWidth);
                n.height(this.canvasHeight);
            });
            bgLayer.draw();
        }
    }

    private resizeStage(): void {
        const w = this.canvasWidth;
        const h = this.canvasHeight;
        this.stage.width(w);
        this.stage.height(h);
        const bgLayer = this.stage.children?.[0] as Konva.Layer;
        if (bgLayer) {
            bgLayer.find('.background').forEach((n: any) => {
                n.width(w);
                n.height(h);
            });
            bgLayer.draw();
        }
        this.layer.draw();
    }

    // Snapping guides
    private handleSnapping(dragNode: Konva.Group): void {
        this.clearGuides();
        const SNAP_THRESHOLD = 5;
        const stageWidth = this.stage.width();
        const stageHeight = this.stage.height();

        const dragBounds = {
            left: dragNode.x(),
            right: dragNode.x() + dragNode.width(),
            top: dragNode.y(),
            bottom: dragNode.y() + dragNode.height(),
            centerX: dragNode.x() + dragNode.width() / 2,
            centerY: dragNode.y() + dragNode.height() / 2,
        };

        // Vertical guide positions: left edge, center, right edge of canvas + other elements
        const vGuides: number[] = [0, stageWidth / 2, stageWidth];
        const hGuides: number[] = [0, stageHeight / 2, stageHeight];

        this.layer.find('Group').forEach((node) => {
            if (node === dragNode) return;
            const g = node as Konva.Group;
            vGuides.push(g.x(), g.x() + g.width(), g.x() + g.width() / 2);
            hGuides.push(g.y(), g.y() + g.height(), g.y() + g.height() / 2);
        });

        // Check vertical snapping (x-axis)
        let snappedX = false;
        for (const guide of vGuides) {
            for (const edge of [dragBounds.left, dragBounds.centerX, dragBounds.right]) {
                if (Math.abs(edge - guide) < SNAP_THRESHOLD) {
                    const offset = edge - dragBounds.left;
                    dragNode.x(guide - offset);
                    this.drawGuideLine(guide, 'vertical');
                    snappedX = true;
                    break;
                }
            }
            if (snappedX) break;
        }

        // Check horizontal snapping (y-axis)
        let snappedY = false;
        for (const guide of hGuides) {
            for (const edge of [dragBounds.top, dragBounds.centerY, dragBounds.bottom]) {
                if (Math.abs(edge - guide) < SNAP_THRESHOLD) {
                    const offset = edge - dragBounds.top;
                    dragNode.y(guide - offset);
                    this.drawGuideLine(guide, 'horizontal');
                    snappedY = true;
                    break;
                }
            }
            if (snappedY) break;
        }
    }

    private drawGuideLine(pos: number, direction: 'vertical' | 'horizontal'): void {
        const line = new Konva.Line({
            points: direction === 'vertical'
                ? [pos, 0, pos, this.stage.height()]
                : [0, pos, this.stage.width(), pos],
            stroke: '#6c63ff',
            strokeWidth: 1,
            dash: [4, 4],
        });
        this.guideLayer.add(line);
        this.guideLayer.draw();
    }

    private clearGuides(): void {
        this.guideLayer.destroyChildren();
        this.guideLayer.draw();
    }

    onSave(): void {
        if (!this.templateName.trim()) {
            this.nameInvalid = true;
            this.notification.warn(this.translate.instant('CARD_TEMPLATES.NAME_REQUIRED'));
            return;
        }

        this.saving = true;
        const payload = {
            name: this.templateName.trim(),
            description: this.templateDescription || undefined,
            cardWidthMm: this.templateWidthMm,
            cardHeightMm: this.templateHeightMm,
            orientation: this.templateOrientation,
            elementsJson: JSON.stringify(this.elements),
            backgroundColor: this.cardBackgroundColor,
        };

        const obs = this.templateId
            ? this.api.update(this.templateId, payload)
            : this.api.create(payload);

        obs.subscribe({
            next: (result) => {
                this.saving = false;
                this.notification.success('CARD_TEMPLATES.SAVE_SUCCESS');
                if (!this.templateId) {
                    this.templateId = result.id;
                    this.router.navigate(['/settings/card-templates', result.id, 'edit'], { replaceUrl: true });
                }
            },
            error: (err) => {
                this.saving = false;
                this.notification.error(err);
            },
        });
    }

    onPreview(): void {
        this.deselectAll();
        this.showPreview = true;
        // Generate QR data URLs for preview
        this.elements.filter(e => e.type === 'qr').forEach(e => this.getPreviewQrUrl(e));
    }

    closePreview(): void {
        this.showPreview = false;
    }

    private previewQrCache = new Map<string, string>();

    getPreviewQrUrl(el: CardTemplateElement): string {
        const content = this.getQrContentForDesigner(el);
        const cacheKey = `${el.id}-${content}-${el.width}`;
        if (!this.previewQrCache.has(cacheKey)) {
            this.previewQrCache.set(cacheKey, '');
            QRCode.toDataURL(content, { width: el.width, margin: 1 }).then((url: string) => {
                this.previewQrCache.set(cacheKey, url);
            });
        }
        return this.previewQrCache.get(cacheKey) || '';
    }

    isPrinterAvailable(): boolean {
        return this.workstationSession.currentState.bound && this.workstationSession.isPrinterConnected();
    }

    canTestPrint(): boolean {
        return !!this.templateId && this.isPrinterAvailable();
    }

    getTestPrintTooltip(): string {
        if (!this.templateId) {
            return this.translate.instant('CARD_TEMPLATES.SAVE_BEFORE_PRINT');
        }
        if (!this.workstationSession.currentState.bound) {
            return this.translate.instant('CARD_TEMPLATES.NO_WORKSTATION');
        }
        if (!this.workstationSession.isPrinterConnected()) {
            return this.translate.instant('CARD_TEMPLATES.NO_PRINTER');
        }
        return this.translate.instant('CARD_TEMPLATES.TEST_PRINT');
    }

    onTestPrint(): void {
        if (!this.templateId || this.testPrinting) {
            if (!this.templateId) {
                this.notification.warn(this.translate.instant('CARD_TEMPLATES.SAVE_BEFORE_PRINT'));
            }
            return;
        }

        if (!this.workstationSession.currentState.bound) {
            this.notification.warn(this.translate.instant('CARD_TEMPLATES.NO_WORKSTATION'));
            return;
        }

        this.testPrinting = true;
        this.api.testPrint(this.templateId).subscribe({
            next: () => {
                this.notification.success(this.translate.instant('CARD_TEMPLATES.TEST_PRINT_SENT'));
                this.testPrinting = false;
            },
            error: (err) => {
                this.notification.error(err);
                this.testPrinting = false;
            },
        });
    }

    goBack(): void {
        this.router.navigate(['/settings/card-templates']);
    }
}
