import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
export type KioskStepId = 1 | 2 | 3 | 4;

export interface KioskStep {
  id: KioskStepId;
  label: string;
  isActive: boolean; // <= active
  isCurrent: boolean; // === active (optional)
}

@Component({
  selector: 'app-steps',
  templateUrl: './steps.component.html',
  styleUrls: ['./steps.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepsComponent implements OnInit {

  /** active step: 1..4 */
  @Input({ required: true }) active!: KioskStepId;

  /** whether the current step is in error state */
  @Input() error = false;

  /** labels per step (optional). */
  @Input() labels: string[] = ['שלב 1', 'שלב 2', 'שלב 3', 'שלב 4'];

  constructor() { }

  ngOnInit() {
  }


  get steps(): KioskStep[] {
    return ([1, 2, 3, 4] as KioskStepId[]).map((id, idx) => ({
      id,
      label: this.labels[idx] ?? `שלב ${id}`,
      isActive: id <= this.active,   // ✅ previous steps also active
      isCurrent: id === this.active, // optional
    }));
  }

}
