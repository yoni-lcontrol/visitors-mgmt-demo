/**
 * Centralized visitor notification types.
 * All notification scenarios, recipients, and channels are defined here.
 */

/** All visitor-related notification scenarios */
export enum VisitorNotificationScenario {
    /** Visit created - notify creator */
    VisitCreated = 'visit_created',
    /** Visit created on behalf - notify the person it was created for */
    VisitCreatedOnBehalf = 'visit_created_on_behalf',
    /** Visit created - notify the visitor */
    VisitCreatedVisitor = 'visit_created_visitor',
    /** Parking approved */
    ParkingApproved = 'parking_approved',
    /** Parking rejected */
    ParkingRejected = 'parking_rejected',
    /** Visitor arrived (escort required) */
    VisitorArrivedWithEscort = 'visitor_arrived_with_escort',
    /** Visitor arrived (no escort required) */
    VisitorArrivedNoEscort = 'visitor_arrived_no_escort',
    /** QR code sent to visitor */
    QrCodeSent = 'qr_code_sent',
    /** Visitor approved without escort (permanent issuer) - notify on-behalf employee */
    VisitorApprovedNoEscort = 'visitor_approved_no_escort',
    /** Host did not approve or did not arrive - notify visitor */
    HostNotApproved = 'host_not_approved',
    /** Visitor departed - notify host */
    VisitorDeparted = 'visitor_departed',
    /** Visitor did not exit - notify host and security center */
    VisitorDidNotExit = 'visitor_did_not_exit',
}

/** Recipient types for visitor notifications */
export enum VisitorNotificationRecipient {
    /** The employee who created the visit */
    VisitCreator = 'visit_creator',
    /** The employee the visit was created on behalf of (visitRequester) */
    VisitRequester = 'visit_requester',
    /** The visitor */
    Visitor = 'visitor',
    /** The host (מארח) — the visit requester or creator depending on context */
    Host = 'host',
    /** The security center (מוקד ביטחון) */
    SecurityCenter = 'security_center',
}

/** Notification channels */
export enum VisitorNotificationChannel {
    Email = 'email',
    Sms = 'sms',
}

/** Template key for message resolution */
export type VisitorNotificationTemplateKey =
    | 'visit_created_confirmation'
    | 'visit_created_on_behalf_confirmation'
    | 'visit_created_visitor_details'
    | 'parking_approved'
    | 'parking_rejected'
    | 'visitor_arrived'
    | 'qr_code_landing'
    | 'visitor_approved_no_escort'
    | 'host_not_approved_go_to_desk'
    | 'visitor_departed'
    | 'visitor_did_not_exit';

/** A single rule in the notification matrix */
export interface VisitorNotificationRule {
    scenario: VisitorNotificationScenario;
    recipient: VisitorNotificationRecipient;
    channels: VisitorNotificationChannel[];
    templateKey: VisitorNotificationTemplateKey;
    /** Optional condition description */
    condition?: string;
}

/** Resolved recipient contact info */
export interface ResolvedRecipient {
    recipientType: VisitorNotificationRecipient;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
}

/** Context data passed to the dispatcher for recipient resolution and template rendering */
export interface VisitorNotificationContext {
    visit: {
        id: string;
        title: string;
        plannedStartTimeUtc: Date;
        plannedEndTimeUtc?: Date | null;
        siteId?: string | null;
        floor?: number | null;
        purposeOfVisit?: string | null;
    };
    visitor?: {
        id: string;
        firstName: string;
        lastName: string;
        personId?: string;
        phone?: string | null;
        email?: string | null;
        carNumber?: string | null;
    };
    creator?: {
        id: string;
        firstName: string;
        lastName: string;
        email?: string | null;
        phone?: string | null;
    };
    requester?: {
        id?: string;
        firstName: string;
        lastName: string;
        email?: string | null;
        phone?: string | null;
    };
    hasEscort: boolean;
    parking?: {
        status: string;
        reviewNote?: string;
    };
    checkInCode?: string;
    checkoutTimeUtc?: Date;
    /** Security center contact info for security-related notifications */
    securityCenter?: {
        email: string;
        name?: string;
    };
}

/** Result of dispatching a single notification */
export interface NotificationDispatchResult {
    scenario: VisitorNotificationScenario;
    recipient: VisitorNotificationRecipient;
    channel: VisitorNotificationChannel;
    success: boolean;
    error?: string;
    skippedReason?: string;
}
