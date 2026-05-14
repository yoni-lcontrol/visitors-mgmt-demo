import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { KioskApiService } from '../../kiosk/kiosk-api.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { VisitResponse } from '../../models/kiosk-api.models';
import { KioskFlowService } from '../../kiosk/kiosk-flow-state.service';

@Component({
  selector: 'app-check-in',
  templateUrl: './check-in.component.html',
  styleUrls: ['./check-in.component.css']
})
export class CheckInComponent {

  readonly codeLength = 6;
  digits: string[] = Array(this.codeLength).fill('');
  error: string | null = null;

  constructor(
    private router: Router,
    private kioskApi: KioskApiService,
    private spinner: NgxSpinnerService,
    private kioskFlowService: KioskFlowService
  ) { }

  get isComplete(): boolean {
    return this.digits.every((d) => d && d.length === 1);
  }

  press(n: number): void {
    const idx = this.digits.findIndex((d) => !d);
    if (idx === -1) return;
    this.digits[idx] = String(n);
  }

  backspace(): void {
    // remove last filled digit
    for (let i = this.digits.length - 1; i >= 0; i--) {
      if (this.digits[i]) {
        this.digits[i] = '';
        return;
      }
    }
  }

  clearAll(): void {
    this.digits = Array(this.codeLength).fill('');
  }

  cancel(): void {
    this.router.navigateByUrl('/home');
  }

  continue(): void {
    this.error = null;
    if (!this.isComplete)
      return;

    this.spinner.show();
    const code = this.digits.join('');

    this.kioskApi.validateVisitCode(code)
      .subscribe({
        next: (visit: VisitResponse) => {
          this.spinner.hide();

          if (visit.ok === false) {
            this.router.navigateByUrl('/visit-not-found');
            return;
          }

          // store globally
          this.kioskFlowService.setVisit(visit);
          this.router.navigateByUrl('/scan');
        },
        error: (err) => {
          this.spinner.hide();
          this.error = err?.error?.message || (err?.status === 404 ? 'Invalid visit code' : 'Request failed');
        },
      });
  }
}
