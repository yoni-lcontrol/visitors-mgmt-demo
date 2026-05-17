import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/permissions/permission.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const SETTINGS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./settings-list/settings-list.component').then(
                (m) => m.SettingsListComponent,
            ),
        canDeactivate: [unsavedChangesGuard],
    },
    {
        path: 'notifications',
        loadComponent: () =>
            import('./notification-settings/notification-settings.component').then(
                (m) => m.NotificationSettingsComponent,
            ),
        canDeactivate: [unsavedChangesGuard],
    },
    {
        path: 'active-directory',
        loadComponent: () =>
            import('./ad-settings/ad-settings.component').then(
                (m) => m.AdSettingsComponent,
            ),
    },
    {
        path: 'ad-group-role-mappings',
        canActivate: [permissionGuard],
        data: { permission: 'settings.read' },
        loadComponent: () =>
            import('./ad-group-role-mappings/ad-group-role-mappings.component').then(
                (m) => m.AdGroupRoleMappingsComponent,
            ),
    },
    {
        path: 'card-templates',
        canActivate: [permissionGuard],
        data: { permission: 'settings.card-templates.read' },
        loadComponent: () =>
            import('./card-templates/card-template-list/card-template-list.component').then(
                (m) => m.CardTemplateListComponent,
            ),
    },
    {
        path: 'card-templates/new',
        canActivate: [permissionGuard],
        data: { permission: 'settings.card-templates.create' },
        loadComponent: () =>
            import('./card-templates/card-designer/card-designer.component').then(
                (m) => m.CardDesignerComponent,
            ),
    },
    {
        path: 'card-templates/:id/edit',
        canActivate: [permissionGuard],
        data: { permission: 'settings.card-templates.update' },
        loadComponent: () =>
            import('./card-templates/card-designer/card-designer.component').then(
                (m) => m.CardDesignerComponent,
            ),
    },
    {
        path: 'buildings',
        canActivate: [permissionGuard],
        data: { permission: 'buildings.read' },
        loadComponent: () =>
            import('./buildings/building-list/building-list.component').then(
                (m) => m.BuildingListComponent,
            ),
    },
    {
        path: 'vehicle-models',
        canActivate: [permissionGuard],
        data: { permission: 'vehicle-models.view' },
        loadComponent: () =>
            import('./vehicle-models/vehicle-model-list.component').then(
                (m) => m.VehicleModelListComponent,
            ),
    },
    {
        path: 'permanent-escorts',
        canActivate: [permissionGuard],
        data: { permission: 'settings.permanent-escorts.read' },
        loadComponent: () =>
            import('./permanent-escorts/permanent-escorts-management.component').then(
                (m) => m.PermanentEscortsManagementComponent,
            ),
    },
    {
        path: 'sectors',
        canActivate: [permissionGuard],
        data: { permission: 'settings.read' },
        loadComponent: () =>
            import('./sectors/sector-list.component').then(
                (m) => m.SectorListComponent,
            ),
    },
];
