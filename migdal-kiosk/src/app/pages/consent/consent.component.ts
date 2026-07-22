import { Component, ElementRef, HostListener, NgZone, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import SignaturePad from 'signature_pad';
import { VisitResponse } from '../../models/kiosk-api.models';
import { PDFDocument, rgb } from 'pdf-lib';
import { KioskApiService } from '../../kiosk/kiosk-api.service';
import { KioskFlowService } from '../../kiosk/kiosk-flow-state.service';
import { KioskConfigService } from '../../config/kiosk-config.service';
import { IdleService } from '../../kiosk/idle.service';
import { PrinterSocketService } from '../../kiosk/printer-socket.service';
import { firstValueFrom } from 'rxjs';
import { ToasterService } from '../../kiosk/toaster.service';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-consent',
  templateUrl: './consent.component.html',
  styleUrls: ['./consent.component.css']
})
export class ConsentComponent implements OnInit {

  @ViewChild('sigCanvas', { static: true }) sigCanvas!: ElementRef<HTMLCanvasElement>;

  pad!: SignaturePad;

  // optional: require PDF fully loaded / scrolled to bottom
  pdfLoaded = false;

  // You can also load from API / assets
  pdfSrc: string = 'assets/abc.pdf';

  // explicit flag that updates when signature changes
  hasSigned = false;

  padReady = false;

  currentVisit: VisitResponse | null = null;

  constructor(
    private zone: NgZone,
    private router: Router,
    private spinner: NgxSpinnerService,
    private toasterService: ToasterService,
    private kioskApiService: KioskApiService,
    private kioskFlowService: KioskFlowService,
    private kioskCfg: KioskConfigService,
    private idle: IdleService,
    private printerSocket: PrinterSocketService,
  ) { }

  ngOnInit() {
    this.currentVisit = this.kioskFlowService.visit;
  }

  ngAfterViewInit(): void {
    this.initSignaturePad();
    this.resizeCanvas();

    this.padReady = true;
    this.hasSigned = !this.pad.isEmpty();
  }

  get hasSignature(): boolean {
    return this.pad && !this.pad.isEmpty();
  }

  get canContinue(): boolean {
    return this.pdfLoaded && this.isSignatureValid();
  }

  onPdfLoaded(_: any): void {
    this.pdfLoaded = true;
  }

  onPageRendered(): void {
    // optional hooks
  }

  clearSignature(): void {
    this.pad.clear();
    this.hasSigned = false;
  }

  private isSignatureValid(): boolean {
    if (!this.pad || this.pad.isEmpty()) return false;

    const data = this.pad.toData();
    let minX = Infinity, minY = Infinity;
    let maxX = 0, maxY = 0;
    let totalPoints = 0;

    data.forEach(stroke => {
      stroke.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
        totalPoints++;
      });
    });

    const width = maxX - minX;
    const height = maxY - minY;

    return totalPoints >= 15 && width > 30 && height > 20;
  }

  async approveAndContinue(): Promise<void> {
    if (!this.canContinue) return;

    const visitorId = this.currentVisit?.visitor?.visitorId;
    if (!visitorId) {
      this.toasterService.showError('ERROR.MISSING_VISITOR_ID');
      return;
    }

    this.idle.pause();
    this.spinner.show();

    try {
      // 1) signature as PNG
      const signatureDataUrl = this.pad.toDataURL('image/png');

      // 2) load original pdf bytes
      const pdfBytes = await this.loadPdfFromAssets(this.pdfSrc);

      // 3) create a signed pdf
      const signedPdfBytes = await this.addSignatureToPdf(pdfBytes, signatureDataUrl);

      // 4) create File to upload
      const file = this.buildPdfFile(signedPdfBytes, 'signed.pdf');

      // 5) arrive (upload + Amadeus + print)
      const result = await firstValueFrom(this.kioskApiService.arrive({
        visitorId,
        visitId: this.currentVisit?.visit?.visitId,
        siteId: this.currentVisit?.visit?.siteId,
        personId: this.currentVisit?.visitor?.personId ?? undefined,
        workstationCode: this.kioskCfg.config.WORKSTATION_CODE,
        file
      }));

      if (!result.ok) {
        await this.router.navigateByUrl('/error');
        return;
      }

      // 6) forward the print job to the paired printer directly (fire-and-forget, don't block success)
      if (result.print) {
        this.printerSocket.sendPrintJob(result.print.correlationId, result.print.printData);
      }

      await this.router.navigateByUrl('/success');
    } catch (err) {
      console.error('arrive failed', err);
      await this.router.navigateByUrl('/error');
    } finally {
      this.spinner.hide();
      this.idle.resume();
    }
  }

  private buildPdfFile(pdfBytes: Uint8Array, filename: string): File {
    // Force an ArrayBuffer (not SharedArrayBuffer) by copying
    const copy = new Uint8Array(pdfBytes.byteLength);
    copy.set(pdfBytes);

    return new File([copy.buffer], filename, { type: 'application/pdf' });
  }


  private async addSignatureToPdf(pdfBytes: Uint8Array, signatureDataUrl: string): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // enable custom fonts (your working approach)
    const fontkitModule = await import('@pdf-lib/fontkit');
    const fontkitObject = (fontkitModule as any).default ?? fontkitModule;
    pdfDoc.registerFontkit(fontkitObject);

    // load Hebrew TTF
    const fontBytes = await fetch('assets/fonts/Alef-Regular.ttf').then(r => r.arrayBuffer());
    const heeboFont = await pdfDoc.embedFont(fontBytes);

    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width } = lastPage.getSize();

    const marginX = 40;
    const bottomY = 35;
    const fontSize = 12;
    const gap = 10;

    // =========================
    // 1) Signature (left-bottom)
    // =========================
    const signatureLabel = 'חתימה:';

    // underline first (left)
    const sigLineStartX = marginX;
    const sigLineEndX = sigLineStartX + 160;

    lastPage.drawLine({
      start: { x: sigLineStartX, y: bottomY },
      end: { x: sigLineEndX, y: bottomY },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    // label on the right of underline
    const sigLabelX = sigLineEndX + gap;
    lastPage.drawText(signatureLabel, {
      x: sigLabelX,
      y: bottomY - 4,
      size: fontSize,
      font: heeboFont,
      color: rgb(0, 0, 0),
    });

    // signature image
    const pngBytes = this.dataUrlToUint8Array(signatureDataUrl);
    const pngImage = await pdfDoc.embedPng(pngBytes);

    const sigMaxW = (sigLineEndX - sigLineStartX) - 10; // fit inside underline width
    const sigMaxH = 55;

    const sigDims = pngImage.scale(1);
    const scale = Math.min(sigMaxW / sigDims.width, sigMaxH / sigDims.height);
    const sigW = sigDims.width * scale;
    const sigH = sigDims.height * scale;

    const sigX = sigLineStartX + ((sigLineEndX - sigLineStartX) - sigW) / 2;
    const sigY = bottomY + 6;

    lastPage.drawImage(pngImage, { x: sigX, y: sigY, width: sigW, height: sigH });

    // =====================================
    // 2) Visitor name (bottom-right)
    // =====================================
    const visitorLabel = 'שם המבקר:';
    const visitorName = `${this.currentVisit?.visitor?.lastName ?? ''} ${this.currentVisit?.visitor?.firstName ?? ''} `.trim();

    // line length = same as signature underline
    const nameLineWidth = (sigLineEndX - sigLineStartX);
    const gap2 = 10;

    // measure label width
    const visitorLabelWidth = heeboFont.widthOfTextAtSize(visitorLabel, fontSize);

    // We anchor everything from the RIGHT margin
    const rightX = width - marginX;

    // label goes at the right side
    const labelX = rightX - visitorLabelWidth;

    // line goes AFTER the label (to the left)
    const lineEndX = labelX - gap2;
    const lineStartX = lineEndX - nameLineWidth;

    // 1) draw label
    lastPage.drawText(visitorLabel, {
      x: labelX,
      y: bottomY - 4,
      size: fontSize,
      font: heeboFont,
      color: rgb(0, 0, 0),
    });

    // 2) draw underline after the label
    lastPage.drawLine({
      start: { x: lineStartX, y: bottomY },
      end: { x: lineEndX, y: bottomY },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    // 3) write name centered on top of the underline
    if (visitorName) {
      const nameTextWidth = heeboFont.widthOfTextAtSize(visitorName, fontSize);
      const lineMidX = (lineStartX + lineEndX) / 2;
      const centeredNameX = lineMidX - (nameTextWidth / 2);

      // keep inside the line bounds (small padding)
      const pad = 6;
      const safeNameX = Math.max(
        lineStartX + pad,
        Math.min(centeredNameX, lineEndX - nameTextWidth - pad)
      );

      lastPage.drawText(visitorName, {
        x: safeNameX,
        y: bottomY + 6,
        size: fontSize,
        font: heeboFont,
        color: rgb(0, 0, 0),
      });
    }

    return await pdfDoc.save();
  }

  private initSignaturePad(): void {
    this.pad = new SignaturePad(this.sigCanvas.nativeElement, {
      minWidth: 1.2,
      maxWidth: 2.6,
      throttle: 16,
    });

    //  run inside Angular so button enables immediately
    this.pad.addEventListener('endStroke', () => {
      this.zone.run(() => {
        this.hasSigned = this.isSignatureValid();
      });
    });
  }

  private dataUrlToUint8Array(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(',')[1] ?? '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  private async loadPdfFromAssets(path: string): Promise<Uint8Array> {
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(`Failed to load PDF: ${res.status} ${res.statusText}`);
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvas();
  }

  private resizeCanvas(): void {
    const canvas = this.sigCanvas.nativeElement;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    const data = this.pad?.toData();

    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);

    const ctx = canvas.getContext('2d');
    if (ctx)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (data)
      this.pad.fromData(data);

    // keep state accurate after resize
    this.hasSigned = this.isSignatureValid();
  }

  goBack(): void {
    this.router.navigateByUrl('/details');
  }
}
