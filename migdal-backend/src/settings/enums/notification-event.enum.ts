export enum NotificationEvent {
    VisitCreated = 'visit_created',
    VisitUpdated = 'visit_updated',
    VisitDeleted = 'visit_deleted',
    VisitorArrivedWithEscort = 'visitor_arrived_with_escort',
    VisitorArrivedWithoutEscort = 'visitor_arrived_without_escort',
    VisitorBlacklisted = 'visitor_blacklisted',
    CheckInCodeSent = 'check_in_code_sent',
    ParkingApproved = 'parking_approved',
    ParkingRejected = 'parking_rejected',
    BlacklistOverrideDecision = 'blacklist_override_decision',
    VisitorCheckedOut = 'visitor_checked_out',
    VisitorOverstay = 'visitor_overstay',
}

export const NOTIFICATION_EVENTS = Object.values(NotificationEvent);
