import {
    isEscortRequiredForVisit,
    isOnBehalfOnlyRole,
    resolveCreatorScopeRequirements,
    shouldRestrictDeletionToOwnVisits,
} from './visit-role-policy';
import { PermissionKey } from '../common/enums/permission-key.enum';

describe('visit-role-policy', () => {
    describe('isEscortRequiredForVisit', () => {
        it('requires escort when escort-required permission exists', () => {
            expect(isEscortRequiredForVisit([PermissionKey.VisitsEscortRequired], true)).toBe(true);
            expect(isEscortRequiredForVisit([PermissionKey.VisitsEscortRequired], false)).toBe(true);
        });

        it('requires escort for self requester when self-requester policy exists', () => {
            expect(isEscortRequiredForVisit([PermissionKey.VisitsEscortRequiredSelfRequester], true)).toBe(true);
            expect(isEscortRequiredForVisit([PermissionKey.VisitsEscortRequiredSelfRequester], false)).toBe(false);
        });

        it('does not require escort without matching permissions', () => {
            expect(isEscortRequiredForVisit([PermissionKey.VisitsCreate], true)).toBe(false);
        });
    });

    describe('isOnBehalfOnlyRole', () => {
        it('enables on-behalf-only when permission exists', () => {
            expect(isOnBehalfOnlyRole([PermissionKey.VisitsOnBehalfOnly])).toBe(true);
        });

        it('does not enable on-behalf-only without permission', () => {
            expect(isOnBehalfOnlyRole([PermissionKey.VisitsCreate])).toBe(false);
        });
    });

    describe('resolveCreatorScopeRequirements', () => {
        it('returns self scope when own-scope permission exists', () => {
            expect(resolveCreatorScopeRequirements([PermissionKey.VisitsScopeOwn])).toEqual({
                includeCurrentUser: true,
                includeTrainingCenterUsers: false,
            });
        });

        it('returns training-center scope when permission exists', () => {
            expect(resolveCreatorScopeRequirements([PermissionKey.VisitsScopeTrainingCenter])).toEqual({
                includeCurrentUser: false,
                includeTrainingCenterUsers: true,
            });
        });

        it('returns combined scope when both scope permissions exist', () => {
            expect(resolveCreatorScopeRequirements([PermissionKey.VisitsScopeOwn, PermissionKey.VisitsScopeTrainingCenter])).toEqual({
                includeCurrentUser: true,
                includeTrainingCenterUsers: true,
            });
        });

        it('returns null for unrestricted permissions', () => {
            expect(resolveCreatorScopeRequirements([PermissionKey.VisitsRead])).toBeNull();
        });
    });

    describe('shouldRestrictDeletionToOwnVisits', () => {
        it('restricts deletion only when own-delete restriction permission exists', () => {
            expect(shouldRestrictDeletionToOwnVisits([PermissionKey.VisitsDeleteOwnOnly])).toBe(true);
            expect(shouldRestrictDeletionToOwnVisits([PermissionKey.VisitsDelete])).toBe(false);
        });
    });
});
