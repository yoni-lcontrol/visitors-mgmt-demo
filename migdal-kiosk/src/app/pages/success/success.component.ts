import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { KioskFlowService } from '../../kiosk/kiosk-flow-state.service';

@Component({
  selector: 'app-success',
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.css']
})
export class SuccessComponent implements OnInit, OnDestroy {

  private redirectTimerId?: number;

  constructor(
    private router: Router,
    private kioskFlowService: KioskFlowService
  ) { }

  ngOnInit(): void {
    //  reset immediately when arriving at success
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

  continue(): void {
    // user clicked "finish" -> cancel timer and go now
    if (this.redirectTimerId) {
      clearTimeout(this.redirectTimerId);
      this.redirectTimerId = undefined;
    }

    this.router.navigateByUrl('/home');
  }
}
