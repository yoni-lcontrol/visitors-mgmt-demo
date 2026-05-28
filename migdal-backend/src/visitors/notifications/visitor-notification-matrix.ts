import {
    VisitorNotificationScenario,
    VisitorNotificationRecipient,
    VisitorNotificationChannel,
    VisitorNotificationRule,
} from './visitor-notification.types';

/**
 * Centralized notification matrix.
 * Each entry defines: scenario → recipient → channels → template.
 * To change notification behavior, modify this array only.
 */
export const VISITOR_NOTIFICATION_MATRIX: VisitorNotificationRule[] = [
    // ─── 1. נפתח זימון → העובד שזימן ───
    {
        scenario: VisitorNotificationScenario.VisitCreated,
        recipient: VisitorNotificationRecipient.VisitCreator,
        channels: [VisitorNotificationChannel.Email],
        templateKey: 'visit_created_confirmation',
    },

    // ─── 2. נפתח זימון → העובד שזימנו בשמו (only when created on behalf) ───
    {
        scenario: VisitorNotificationScenario.VisitCreatedOnBehalf,
        recipient: VisitorNotificationRecipient.VisitRequester,
        channels: [VisitorNotificationChannel.Email],
        templateKey: 'visit_created_on_behalf_confirmation',
        condition: 'Only when visit is created on behalf of another employee',
    },

    // ─── 3. נפתח זימון → האורח ───
    {
        scenario: VisitorNotificationScenario.VisitCreatedVisitor,
        recipient: VisitorNotificationRecipient.Visitor,
        channels: [VisitorNotificationChannel.Email, VisitorNotificationChannel.Sms],
        templateKey: 'visit_created_visitor_details',
    },

    // ─── 4. אישור חניה → העובד שזימן ───
    {
        scenario: VisitorNotificationScenario.ParkingApproved,
        recipient: VisitorNotificationRecipient.VisitCreator,
        channels: [VisitorNotificationChannel.Email],
        templateKey: 'parking_approved',
    },

    // ─── 5. נדחה אישור חניה → העובד שזימן ───
    {
        scenario: VisitorNotificationScenario.ParkingRejected,
        recipient: VisitorNotificationRecipient.VisitCreator,
        channels: [VisitorNotificationChannel.Email],
        templateKey: 'parking_rejected',
    },

    // ─── 6. הגעת אורח עם ליווי → העובד שזימן + העובד שזימנו בשמו ───
    {
        scenario: VisitorNotificationScenario.VisitorArrivedWithEscort,
        recipient: VisitorNotificationRecipient.VisitCreator,
        channels: [VisitorNotificationChannel.Email, VisitorNotificationChannel.Sms],
        templateKey: 'visitor_arrived',
    },
    {
        scenario: VisitorNotificationScenario.VisitorArrivedWithEscort,
        recipient: VisitorNotificationRecipient.VisitRequester,
        channels: [VisitorNotificationChannel.Email, VisitorNotificationChannel.Sms],
        templateKey: 'visitor_arrived',
        condition: 'Only when visit was created on behalf of another employee',
    },

    // ─── 7. הגעת אורח ללא ליווי → העובד שזימן + העובד שזימנו בשמו ───
    {
        scenario: VisitorNotificationScenario.VisitorArrivedNoEscort,
        recipient: VisitorNotificationRecipient.VisitCreator,
        channels: [VisitorNotificationChannel.Email, VisitorNotificationChannel.Sms],
        templateKey: 'visitor_arrived',
    },
    {
        scenario: VisitorNotificationScenario.VisitorArrivedNoEscort,
        recipient: VisitorNotificationRecipient.VisitRequester,
        channels: [VisitorNotificationChannel.Email, VisitorNotificationChannel.Sms],
        templateKey: 'visitor_arrived',
        condition: 'Only when visit was created on behalf of another employee',
    },

    // ─── 8. קבלת QR → אורח ───
    {
        scenario: VisitorNotificationScenario.QrCodeSent,
        recipient: VisitorNotificationRecipient.Visitor,
        channels: [VisitorNotificationChannel.Sms],
        templateKey: 'qr_code_landing',
    },

    // ─── 9. אישור אורח ללא ליווי (מנפיק קבוע) → העובד שזימנו בשמו ───
    {
        scenario: VisitorNotificationScenario.VisitorApprovedNoEscort,
        recipient: VisitorNotificationRecipient.VisitRequester,
        channels: [VisitorNotificationChannel.Email, VisitorNotificationChannel.Sms],
        templateKey: 'visitor_approved_no_escort',
    },

    // ─── 10. מארח לא אישר / לא הגיע → אורח ───
    {
        scenario: VisitorNotificationScenario.HostNotApproved,
        recipient: VisitorNotificationRecipient.Visitor,
        channels: [VisitorNotificationChannel.Sms],
        templateKey: 'host_not_approved_go_to_desk',
    },

    // ─── 11. יציאת האורח → מארח (no email/sms defined) ───
    // TODO: Currently no channels are defined in the matrix for this scenario.
    // If in-app / WebSocket notification is needed, handle it separately.
    // Uncomment and add channels when requirements are clarified.
    // {
    //     scenario: VisitorNotificationScenario.VisitorDeparted,
    //     recipient: VisitorNotificationRecipient.Host,
    //     channels: [],
    //     templateKey: 'visitor_departed',
    // },

    // ─── 12. אורח לא יצא → מארח + מוקד ביטחון (email only) ───
    {
        scenario: VisitorNotificationScenario.VisitorDidNotExit,
        recipient: VisitorNotificationRecipient.Host,
        channels: [VisitorNotificationChannel.Email],
        templateKey: 'visitor_did_not_exit',
    },
    {
        scenario: VisitorNotificationScenario.VisitorDidNotExit,
        recipient: VisitorNotificationRecipient.SecurityCenter,
        channels: [VisitorNotificationChannel.Email],
        templateKey: 'visitor_did_not_exit',
    },
];
