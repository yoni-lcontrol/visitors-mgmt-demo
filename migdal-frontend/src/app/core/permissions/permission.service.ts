import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
    constructor(private authService: AuthService) { }

    private normalize(value: string): string {
        return value.trim().toLowerCase();
    }

    hasPermission(permission: string): boolean {
        const user = this.authService.currentUser;
        if (!user) return false;
        return user.permissions.includes(permission);
    }

    hasAnyPermission(permissions: string[]): boolean {
        return permissions.some((p) => this.hasPermission(p));
    }

    hasAllPermissions(permissions: string[]): boolean {
        return permissions.every((p) => this.hasPermission(p));
    }

    hasRole(role: string): boolean {
        const user = this.authService.currentUser;
        if (!user) return false;
        const targetRole = this.normalize(role);
        return user.roles.some((r) => this.normalize(r) === targetRole);
    }

    hasAnyRole(roles: string[]): boolean {
        return roles.some((r) => this.hasRole(r));
    }

    getCurrentUserId(): string | null {
        return this.authService.currentUser?.id ?? null;
    }
}
