import { Component, OnInit, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { SectorsLookupService, SectorLookupItem } from '@core/services/sectors-lookup.service';

@Component({
    selector: 'app-sector-list',
    standalone: true,
    imports: [TranslateModule, TableModule, InputTextModule],
    template: `
        <div class="page-header">
            <div class="header-info">
                <h1>{{ 'SECTORS.TITLE' | translate }}</h1>
                <p class="header-description">{{ 'SECTORS.DESCRIPTION' | translate }}</p>
            </div>
        </div>

        <div class="card table-card">
            <p-table
                #dt
                [value]="sectors"
                [loading]="loading"
                [paginator]="true"
                [rows]="20"
                [showCurrentPageReport]="true"
                [rowsPerPageOptions]="[10, 20, 50]"
                [globalFilterFields]="['name']"
                dataKey="id"
                styleClass="p-datatable-sm p-datatable-striped p-datatable-gridlines"
                currentPageReportTemplate="{first}-{last} / {totalRecords}"
                paginatorDropdownAppendTo="body"
            >
                <ng-template pTemplate="caption">
                    <div class="table-header">
                        <span class="p-input-icon-left search-box">
                            <i class="pi pi-search"></i>
                            <input pInputText type="text" (input)="dt.filterGlobal($any($event.target).value, 'contains')" [placeholder]="'COMMON.SEARCH' | translate" />
                        </span>
                    </div>
                </ng-template>
                <ng-template pTemplate="header">
                    <tr>
                        <th pSortableColumn="name">{{ 'SECTORS.NAME' | translate }} <p-sortIcon field="name" /> <p-columnFilter field="name" type="text" display="menu"></p-columnFilter></th>
                    </tr>
                </ng-template>
                <ng-template pTemplate="body" let-item>
                    <tr>
                        <td>{{ item.name }}</td>
                    </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                    <tr>
                        <td class="empty">{{ 'COMMON.NO_DATA' | translate }}</td>
                    </tr>
                </ng-template>
            </p-table>
        </div>
    `,
    styles: [`
        :host { display: block; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
        .page-header h1 { margin: 0; font-size: 1.5rem; }
        .header-description { margin: 0.35rem 0 0; color: var(--color-text-secondary, #5c5a78); }
        .table-card { padding: 0; overflow: hidden; }
        .table-header { display: flex; justify-content: flex-start; }
        .search-box { position: relative; min-width: 280px; }
        .search-box i { position: absolute; top: 50%; transform: translateY(-50%); inset-inline-start: 0.75rem; color: var(--color-text-muted, #9896ad); }
        .search-box input { width: 100%; padding-inline-start: 2.2rem; }
        .empty { text-align: center; padding: 1rem; }
    `],
})
export class SectorListComponent implements OnInit {
    private readonly sectorsLookup = inject(SectorsLookupService);

    sectors: SectorLookupItem[] = [];
    loading = false;

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;
        this.sectorsLookup.getActiveSectors().subscribe({
            next: (items) => {
                this.sectors = items;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            },
        });
    }
}
