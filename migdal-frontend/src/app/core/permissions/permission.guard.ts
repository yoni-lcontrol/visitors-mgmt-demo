import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from './permission.service';

export const permissionGuard: CanActivateFn = (route) => {
    const permissionService = inject(PermissionService);
    const router = inject(Router);

    const requiredPermission = route.data?.['permission'] as string | undefined;

    if (!requiredPermission) {
        return true;
    }

    if (permissionService.hasPermission(requiredPermission)) {
        return true;
    }

    return router.createUrlTree(['/dashboard']);
};
