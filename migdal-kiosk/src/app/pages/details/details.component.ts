import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { VisitResponse } from '../../models/kiosk-api.models';
import { KioskFlowService } from '../../kiosk/kiosk-flow-state.service';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.css']
})
export class DetailsComponent implements OnInit, OnDestroy {

  loading = false;
  currentVisit: VisitResponse | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private kioskFlowService: KioskFlowService
  ) { }

  ngOnInit(): void {
    this.currentVisit = this.kioskFlowService.visit;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // same logic pattern as your other components
  goBack(): void {
    this.router.navigateByUrl('/scan');
  }

  continue(): void {
    this.kioskFlowService.setDetailsConfirmed();
    this.router.navigateByUrl('/consent'); // change to your real next route
  }

}