import { Routes } from '@angular/router';

export const WORKSTATIONS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./workstation-list.component').then(
                (m) => m.WorkstationListComponent,
            ),
    },
];
