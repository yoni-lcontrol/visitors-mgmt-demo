import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { distinctUntilChanged, skip } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SignalrService, ScanResult, ScanStatus } from '../../kiosk/signalr.service';
import { ToasterService } from '../../kiosk/toaster.service';
import { KioskFlowService } from '../../kiosk/kiosk-flow-state.service';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.component.html',
  styleUrls: ['./scan.component.css'],
})
export class ScanComponent implements OnInit {

  connected = false;
  isLoading = true;
  scanningStarted = false;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private router: Router,
    private signalr: SignalrService,
    private spinner: NgxSpinnerService,
    private toasterService: ToasterService,
    private kioskFlowService: KioskFlowService
  ) { }

  ngOnInit(): void {
    this.isLoading = false;

    this.bindScanStatus();
    this.bindScanResults();

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

  private bindConnection(): void {
    this.signalr.connected$
      .pipe(
        skip(1),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((isUp) => {
        this.connected = isUp;

        if (isUp) {
          this.isLoading = false;
          this.spinner.hide();
          return;
        }

        this.spinner.hide();
        this.toasterService.showError('ERROR.SCANNER_CONNECTION_ERROR');
        this.router.navigate(['/home']);
      });
  }

  private bindScanStatus(): void {
    this.signalr.scanStatus$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status: ScanStatus) => {
        if (status.state === 'scanning') {
          this.scanningStarted = true;
          this.spinner.show();
        }
      });
  }

  private bindScanResults(): void {
    this.signalr.scanResults$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((scan: ScanResult) => this.handleScanResult(scan));
  }

  private handleScanResult(scan: ScanResult): void {
    // TODO: restore visit-based person ID matching when visit flow is ready
    // const expectedPersonId = this.kioskFlowService.visit?.visitor?.personId;

    const stopUi = () => {
      this.spinner.hide();
      this.scanningStarted = false;
    };

    if (!scan) {
      stopUi();
      this.toasterService.showError('ERROR.NO_ID_DETECTED_IN_SCAN');
      return;
    }

    if (scan.error) {
      stopUi();
      this.toasterService.showError('ERROR.DOCUMENT_SCAN_ERROR');
      return;
    }

    if (!scan.personId) {
      stopUi();
      this.toasterService.showError('ERROR.NO_ID_DETECTED_IN_SCAN');
      return;
    }

    // TODO: restore person ID matching when visit flow is ready
    // if (!expectedPersonId || scan.personId !== expectedPersonId) {
    //   stopUi();
    //   this.toasterService.showError('ERROR.SCANNED_ID_NOT_MATCH');
    //   return;
    // }

    // update the visitor image in the stored visitResponse
    if (scan.image)
      this.kioskFlowService.updateVisitor({ image: this.toDataUrl(scan.image) });

    // success
    this.kioskFlowService.setScanPassed();
    this.router.navigate(['/details']);
  }

  private toDataUrl(imgBase64: string): string {
    return imgBase64.startsWith('data:')
      ? imgBase64
      : `data:image/jpeg;base64,${imgBase64}`;
  }
}
