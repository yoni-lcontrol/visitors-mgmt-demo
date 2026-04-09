import { Component, OnInit, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ApiService } from '@core/api/api.service';
import { downloadBlob } from '@core/utils/download.util';
import { Door, PaginatedResult } from '@core/models/entities.model';

@Component({
  selector: 'app-door-list',
  standalone: true,
  imports: [TranslateModule, TableModule, InputTextModule],
  template: `
    <div class="page-header">
      <h1>{{ 'ACCESS_CONTROL.DOORS' | translate }}</h1>
      <button class="btn btn-secondary" (click)="exportData()"><i class="pi pi-file-excel"></i> {{ 'COMMON.EXPORT' | translate }}</button>
    </div>
    <div class="card table-card">
      <p-table
        #dt
        [value]="doors"
        [lazy]="true"
        (onLazyLoad)="onLazyLoad($event)"
        [loading]="loading"
        [totalRecords]="totalRecords"
        [paginator]="true"
        [rows]="rows"
        [first]="first"
        [showCurrentPageReport]="true"
        [rowsPerPageOptions]="[10, 25, 50]"
        [globalFilterFields]="['name', 'status']"
        dataKey="id"
        styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
        currentPageReportTemplate="{first}-{last} / {totalRecords}"
        paginatorDropdownAppendTo="body"
      >
        <ng-template pTemplate="caption">
          <div class="table-header">
            <span class="p-input-icon-left">
              <i class="pi pi-search"></i>
              <input pInputText type="text" (input)="dt.filterGlobal($any($event.target).value, 'contains')" [placeholder]="'COMMON.SEARCH' | translate" />
            </span>
          </div>
        </ng-template>
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="name">{{ 'ACCESS_CONTROL.DOOR_NAME' | translate }} <p-sortIcon field="name" /> <p-columnFilter field="name" type="text" display="menu"></p-columnFilter></th>
            <th pSortableColumn="doorNumber">{{ 'ACCESS_CONTROL.DOOR_NUMBER' | translate }} <p-sortIcon field="doorNumber" /> <p-columnFilter field="doorNumber" type="numeric" display="menu"></p-columnFilter></th>
            <th pSortableColumn="status">{{ 'COMMON.STATUS' | translate }} <p-sortIcon field="status" /> <p-columnFilter field="status" type="text" display="menu"></p-columnFilter></th>
            <th>{{ 'ACCESS_CONTROL.DOOR_IOS' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-door>
          <tr>
            <td class="name-cell">{{ door.name }}</td>
            <td>{{ door.doorNumber }}</td>
            <td><span class="status-badge" [attr.data-status]="door.status">{{ door.status }}</span></td>
            <td>{{ door.doorIos.length }}</td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="4" class="empty">{{ 'COMMON.NO_DATA' | translate }}</td></tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styles: [`
      :host { display: block; }
      .table-card { padding: 0; overflow: hidden; }
      .table-header { display: flex; align-items: center; gap: 0.5rem; }
      .p-input-icon-left { position: relative; }
      .p-input-icon-left i { position: absolute; top: 50%; transform: translateY(-50%); inset-inline-start: 0.75rem; color: var(--color-text-muted, #9896ad); }
      .p-input-icon-left input { padding-inline-start: 2.25rem; }
      .filter-input { width: 100%; padding: 0.4rem 0.65rem; font-size: 0.82rem; }
      .name-cell { font-weight: 500; }
      .status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.78rem; font-weight: 600; background: var(--color-primary-wash, #eeedf8); color: var(--color-text-secondary, #5c5a78); }
      .status-badge[data-status="Active"] { background: #e8f5e9; color: #2e7d32; }
      .status-badge[data-status="Inactive"] { background: #ffebee; color: #c62828; }
    `],
})
export class DoorListComponent implements OnInit {
  private api = inject(ApiService);
  doors: Door[] = [];
  totalRecords = 0;
  rows = 25;
  first = 0;
  sortField = 'name';
  sortOrder = 1;
  loading = false;
  private lastLazyEvent: any = { first: 0, rows: 25, sortField: 'name', sortOrder: 1, filters: {} };

  ngOnInit(): void {
    this.loadData();
  }

  loadData(event: any = this.lastLazyEvent): void {
    this.loading = true;
    this.lastLazyEvent = event;
    this.first = event.first ?? 0;
    this.rows = event.rows ?? 25;
    this.sortField = event.sortField || 'name';
    this.sortOrder = event.sortOrder || 1;

    const page = Math.floor(this.first / this.rows) + 1;
    const params: Record<string, string | number> = {
      page,
      limit: this.rows,
      sortBy: this.sortField,
      sortOrder: this.sortOrder === 1 ? 'ASC' : 'DESC',
      filters: JSON.stringify(event.filters ?? {}),
    };

    const global = event.filters?.global?.value;
    if (global) params['search'] = global;

    this.api.get<PaginatedResult<Door>>('/access-control/doors', params).subscribe((r) => {
      this.doors = r.items;
      this.totalRecords = r.total;
      this.loading = false;
    });
  }

  onLazyLoad(event: any): void {
    this.loadData(event);
  }

  exportData(): void {
    const event = this.lastLazyEvent ?? {};
    const params: Record<string, string | number> = {
      sortBy: event.sortField || 'name',
      sortOrder: (event.sortOrder || 1) === 1 ? 'ASC' : 'DESC',
      filters: JSON.stringify(event.filters ?? {}),
    };
    const global = event.filters?.global?.value;
    if (global) params['search'] = global;

    this.api.download('/access-control/doors/export', params).subscribe((blob) => {
      downloadBlob(blob, 'doors.xlsx');
    });
  }
}
