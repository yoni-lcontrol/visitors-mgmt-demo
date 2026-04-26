import { Routes } from '@angular/router';

export const VISITORS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./visitor-list.component').then(
                (m) => m.VisitorListComponent,
            ),
    },
];
