import { Visit } from './entities/visit.entity';
import { Visitor } from './entities/visitor.entity';
import { SmsTemplateData } from '../settings/sms-template-renderer.service';
import { NotificationEvent } from '../settings/enums/notification-event.enum';

export function visitHasEscort(visit: Visit): boolean {
    return !!visit.visitEscorts && visit.visitEscorts.length > 0;
}

export function resolveVisitorArrivedEvent(visit: Visit): NotificationEvent {
    return visitHasEscort(visit)
        ? NotificationEvent.VisitorArrivedWithEscort
        : NotificationEvent.VisitorArrivedWithoutEscort;
}

export function resolveVisitRequester(visit: Visit): { firstName: string; lastName: string; phone: string; email: string } | null {
    if (visit.visitRequesterUserId && visit.visitRequesterUser) {
        return {
            firstName: visit.visitRequesterUser.firstName,
            lastName: visit.visitRequesterUser.lastName,
            phone: visit.visitRequesterUser.phone ?? '',
            email: visit.visitRequesterUser.email ?? '',
        };
    }
    return null;
}

/** The user who performed the booking action — may be the same person as the visit requester (self-booked) or different (booked on behalf of someone else). */
export function resolveCreatedBy(visit: Visit): { firstName: string; lastName: string; phone: string; email: string } | null {
    if (visit.createdByUserId && visit.createdByUser) {
        return {
            firstName: visit.createdByUser.firstName,
            lastName: visit.createdByUser.lastName,
            phone: visit.createdByUser.phone ?? '',
            email: visit.createdByUser.email ?? '',
        };
    }
    return null;
}

export function buildSmsData(visit: Visit, visitor?: Visitor): SmsTemplateData {
    const req = resolveVisitRequester(visit);
    const creator = resolveCreatedBy(visit);
    return {
        visit: {
            title: visit.title,
            startTime: visit.plannedStartTimeUtc?.toLocaleString('he-IL') ?? '',
            endTime: visit.plannedEndTimeUtc?.toLocaleString('he-IL') ?? '',
            hostName: req ? [req.firstName, req.lastName].filter(Boolean).join(' ') : '',
            siteName: visit.siteId ?? '',
            purposeOfVisit: visit.purposeOfVisit ?? '',
        },
        visitor: visitor ? {
            firstName: visitor.firstName,
            lastName: visitor.lastName,
            personId: visitor.personId,
            phone: visitor.phone ?? '',
            carNumber: visitor.carNumber ?? '',
        } : undefined,
        requester: req ? {
            firstName: req.firstName || undefined,
            lastName: req.lastName || undefined,
            phone: req.phone || undefined,
            email: req.email || undefined,
        } : undefined,
        createdBy: creator ? {
            firstName: creator.firstName || undefined,
            lastName: creator.lastName || undefined,
            phone: creator.phone || undefined,
            email: creator.email || undefined,
        } : undefined,
    };
}
