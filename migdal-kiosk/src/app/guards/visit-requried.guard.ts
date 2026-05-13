import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { KioskFlowService } from '../kiosk/kiosk-flow-state.service';

@Injectable({ providedIn: 'root' })
export class VisitRequiredGuard implements CanActivate {

  constructor(private flow: KioskFlowService, private router: Router) { }

  canActivate(): boolean {
    if (this.flow.visit)
      return true;
    this.router.navigateByUrl('/home');
    return false;
  }
}