import { Visit } from './entities/visit.entity';
import { Visitor } from './entities/visitor.entity';
import { SmsTemplateData } from '../settings/sms-template-renderer.service';

export function resolveVisitRequester(visit: Visit): { firstName: string; lastName: string; phone: string; email: string } | null {
    if (visit.visitRequesterUserId && visit.visitRequesterUser) {
        return {
            firstName: visit.visitRequesterUser.firstName,
            lastName: visit.visitRequesterUser.lastName,
            phone: visit.visitRequesterUser.phone ?? '',
            email: visit.visitRequesterUser.email ?? '',
        };
    }
    if (visit.visitRequesterFirstName) {
        return {
            firstName: visit.visitRequesterFirstName,
            lastName: visit.visitRequesterLastName ?? '',
            phone: visit.visitRequesterPhone ?? '',
            email: visit.visitRequesterEmail ?? '',
        };
    }
    return null;
}

export function buildSmsData(visit: Visit, visitor?: Visitor): SmsTemplateData {
    const req = resolveVisitRequester(visit);
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
            phone: req.phone || undefined,
            email: req.email || undefined,
        } : undefined,
    };
}
