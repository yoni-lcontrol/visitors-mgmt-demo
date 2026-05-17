import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { KioskFlowService } from '../kiosk/kiosk-flow-state.service';

@Injectable({ providedIn: 'root' })
export class DetailsConfirmedGuard implements CanActivate {

  constructor(private flow: KioskFlowService, private router: Router) { }

  canActivate(): boolean {
    if (!this.flow.visit) {
      this.router.navigateByUrl('/home');
      return false;
    }
    if (!this.flow.state.detailsConfirmed) {
      this.router.navigateByUrl('/details');
      return false;
    }
    return true;
  }
}