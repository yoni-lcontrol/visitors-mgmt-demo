import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { filter, first } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { KioskSocketService, ScanResult, ScanStatus, ScannerStatus } from '../../kiosk/kiosk-socket.service';
import { KioskApiService } from '../../kiosk/kiosk-api.service';
import { ToasterService } from '../../kiosk/toaster.service';
import { KioskFlowService } from '../../kiosk/kiosk-flow-state.service';
import { VisitResponse } from '../../models/kiosk-api.models';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.component.html',
  styleUrls: ['./scan.component.css'],
})
export class ScanComponent implements OnInit {

  connected = false;
  isLoading = true;
  scanningStarted = false;
  scanError = false;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private router: Router,
    private kioskSocket: KioskSocketService,
    private kioskApi: KioskApiService,
    private spinner: NgxSpinnerService,
    private toasterService: ToasterService,
    private kioskFlowService: KioskFlowService
  ) { }

  ngOnInit(): void {
    this.isLoading = false;

    this.checkScannerConnected();
    this.bindScanStatus();
    this.bindScanResults();

    // Check for a buffered scan result that arrived before this page was mounted
    const pending = this.kioskSocket.consumePendingScanResult();
    if (pending) {
      this.handleScanResult(pending);
    }

    this.destroyRef.onDestroy(() => {
      this.spinner.hide();
    });
  }

  continue(): void {
    this.kioskFlowService.setScanPassed();
    this.router.navigate(['/details']);
  }

  cancel(): void {
    this.router.navigateByUrl('/home');
  }

  private checkScannerConnected(): void {
    // Wait until the kiosk is registered before checking scanner status
    this.kioskSocket.registered$
      .pipe(
        filter((registered) => registered),
        first(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.kioskSocket.scannerStatus$
          .pipe(first(), takeUntilDestroyed(this.destroyRef))
          .subscribe((status: ScannerStatus) => {
            if (!status.connected || !status.deviceConnected) {
              this.toasterService.showError('ERROR.SCANNER_CONNECTION_ERROR');
              this.router.navigate(['/home']);
            }
          });

        this.kioskSocket.checkScannerStatus();
      });
  }

  private bindScanStatus(): void {
    this.kioskSocket.scanStatus$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status: ScanStatus) => {
        if (status.state === 'scanning') {
          this.scanningStarted = true;
          this.spinner.show();
        }
      });
  }

  private bindScanResults(): void {
    this.kioskSocket.scanResults$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((scan: ScanResult) => {
        // Clear buffer so it's not replayed on next mount
        this.kioskSocket.consumePendingScanResult();
        this.handleScanResult(scan);
      });
  }

  private handleScanResult(scan: ScanResult): void {
    console.log('[ScanComponent] Received scan result:', scan);

    const stopUi = () => {
      this.spinner.hide();
      this.scanningStarted = false;
    };

    if (!scan) {
      stopUi();
      this.scanError = true;
      return;
    }

    if (!scan.success || !scan.result) {
      stopUi();
      this.scanError = true;
      return;
    }

    const data = scan.result;

    if (!data.personId && !data.identifyNumber) {
      stopUi();
      this.scanError = true;
      return;
    }

    // Look up today's visit for this personId (fallback to identifyNumber)
    this.kioskApi.validatePersonId(data.personId || data.identifyNumber, data.identifyNumber).subscribe({
      next: (visit: VisitResponse) => {
        stopUi();
        if (visit.ok === false) {
          this.router.navigateByUrl('/visit-not-found');
          return;
        }

        this.kioskFlowService.setVisit(visit);

        if (data.image)
          this.kioskFlowService.updateVisitor({ image: this.toDataUrl(data.image) });

        this.kioskFlowService.setScanPassed();
        this.router.navigate(['/details']);
      },
      error: () => {
        stopUi();
        this.scanError = true;
      },
    });
  }

  private toDataUrl(imgBase64: string): string {
    return imgBase64.startsWith('data:')
      ? imgBase64
      : `data:image/jpeg;base64,${imgBase64}`;
  }
}
