import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { KioskFlowService } from '../../kiosk/kiosk-flow-state.service';

@Component({
  selector: 'app-error-page',
  templateUrl: './error-page.component.html',
  styleUrls: ['./error-page.component.css'],
})
export class ErrorPageComponent implements OnInit, OnDestroy {
  private redirectTimerId?: number;

  constructor(
    private router: Router,
    private kioskFlowService: KioskFlowService,
  ) { }

  ngOnInit(): void {
    this.kioskFlowService.reset();

    this.redirectTimerId = window.setTimeout(() => {
      this.router.navigateByUrl('/home');
    }, 15_000);
  }

  ngOnDestroy(): void {
    if (this.redirectTimerId) {
      clearTimeout(this.redirectTimerId);
      this.redirectTimerId = undefined;
    }
  }

  retry(): void {
    this.cancelTimer();
    this.router.navigateByUrl('/scan');
  }

  home(): void {
    this.cancelTimer();
    this.router.navigateByUrl('/home');
  }

  private cancelTimer(): void {
    if (this.redirectTimerId) {
      clearTimeout(this.redirectTimerId);
      this.redirectTimerId = undefined;
    }
  }
}
