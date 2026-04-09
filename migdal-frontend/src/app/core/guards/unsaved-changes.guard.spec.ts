import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { unsavedChangesGuard, HasUnsavedChanges } from './unsaved-changes.guard';
import { ConfirmService } from '../services/confirm.service';

describe('unsavedChangesGuard', () => {
    let mockConfirmService: jasmine.SpyObj<ConfirmService>;
    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = {} as RouterStateSnapshot;

    beforeEach(() => {
        mockConfirmService = jasmine.createSpyObj('ConfirmService', ['confirm']);

        TestBed.configureTestingModule({
            providers: [
                { provide: ConfirmService, useValue: mockConfirmService },
            ],
        });
    });

    function runGuard(component: HasUnsavedChanges): ReturnType<typeof unsavedChangesGuard> {
        return TestBed.runInInjectionContext(() =>
            unsavedChangesGuard(component, mockRoute, mockState, mockState),
        );
    }

    it('should allow navigation when no unsaved changes', async () => {
        const component: HasUnsavedChanges = { hasUnsavedChanges: () => false };
        const result = await runGuard(component);
        expect(result).toBeTrue();
        expect(mockConfirmService.confirm).not.toHaveBeenCalled();
    });

    it('should show confirmation when unsaved changes exist', async () => {
        mockConfirmService.confirm.and.returnValue(Promise.resolve(true));
        const component: HasUnsavedChanges = { hasUnsavedChanges: () => true };

        const result = await runGuard(component);

        expect(mockConfirmService.confirm).toHaveBeenCalledWith('COMMON.UNSAVED_CHANGES_WARNING');
        expect(result).toBeTrue();
    });

    it('should block navigation when user rejects confirmation', async () => {
        mockConfirmService.confirm.and.returnValue(Promise.resolve(false));
        const component: HasUnsavedChanges = { hasUnsavedChanges: () => true };

        const result = await runGuard(component);

        expect(result).toBeFalse();
    });
});
