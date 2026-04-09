export enum NotificationEvent {
    VisitCreated = 'visit_created',
    VisitUpdated = 'visit_updated',
    VisitDeleted = 'visit_deleted',
    VisitorArrived = 'visitor_arrived',
    VisitorBlacklisted = 'visitor_blacklisted',
    CheckInCodeSent = 'check_in_code_sent',
    ParkingRequestDecision = 'parking_request_decision',
    VisitorCheckedOut = 'visitor_checked_out',
    VisitorOverstay = 'visitor_overstay',
}

export const NOTIFICATION_EVENTS = Object.values(NotificationEvent);
