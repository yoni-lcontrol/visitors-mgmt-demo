import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { ConfirmService } from '../services/confirm.service';

export interface HasUnsavedChanges {
    hasUnsavedChanges(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async (component) => {
    if (!component.hasUnsavedChanges()) {
        return true;
    }
    const confirmService = inject(ConfirmService);
    return confirmService.confirm('COMMON.UNSAVED_CHANGES_WARNING');
};
