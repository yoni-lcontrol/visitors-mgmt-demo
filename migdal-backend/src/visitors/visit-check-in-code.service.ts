import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, MoreThan, And } from 'typeorm';
import * as crypto from 'crypto';
import { VisitVisitorCheckInCode } from './entities/visit-visitor-check-in-code.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { VisitVisitorStatus } from './entities/visit-visitor-status.entity';
import { Visit } from './entities/visit.entity';
import { Visitor } from './entities/visitor.entity';
import { VisitorStatus } from './enums/visitor-status.enum';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { SmsNotificationService } from '../settings/sms-notification.service';
import { EmailNotificationService } from '../settings/email-notification.service';
import { NotificationEvent } from '../settings/enums/notification-event.enum';
import { AuditService } from '../audit/audit.service';

const MAX_CODE_GENERATION_ATTEMPTS = 20;
const EARLY_ARRIVAL_BUFFER_MINUTES = 60;

@Injectable()
export class VisitCheckInCodeService {
    private readonly logger = new Logger(VisitCheckInCodeService.name);

    constructor(
        @InjectRepository(VisitVisitorCheckInCode)
        private readonly codeRepo: Repository<VisitVisitorCheckInCode>,
        @InjectRepository(VisitVisitor)
        private readonly visitVisitorRepo: Repository<VisitVisitor>,
        @InjectRepository(VisitVisitorStatus)
        private readonly statusRepo: Repository<VisitVisitorStatus>,
        @InjectRepository(Visit)
        private readonly visitRepo: Repository<Visit>,
        @InjectRepository(Visitor)
        private readonly visitorRepo: Repository<Visitor>,
        private readonly dataSource: DataSource,
        private readonly wsGateway: UsersGateway,
        private readonly smsNotification: SmsNotificationService,
        private readonly emailNotification: EmailNotificationService,
        private readonly auditService: AuditService,
    ) { }

    // ── Code Generation ──

    /**
     * Generate a unique 6-digit numeric code that does not overlap with
     * any active unused code in the given validity window.
     */
    async generateUniqueCode(validFrom: Date, validTo: Date): Promise<string> {
        for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
            const code = this.generate6DigitCode();
            const conflict = await this.codeRepo
                .createQueryBuilder('c')
                .where('c.code = :code', { code })
                .andWhere('c.isActive = :active', { active: true })
                .andWhere('c.usedAtUtc IS NULL')
                .andWhere('c.validFromUtc < :validTo', { validTo })
                .andWhere('c.validToUtc > :validFrom', { validFrom })
                .getExists();

            if (!conflict) return code;
        }
        throw new ConflictException('Unable to generate a unique check-in code after maximum retries');
    }

    /**
     * Generate a cryptographically random 6-digit numeric code (preserves leading zeroes).
     */
    private generate6DigitCode(): string {
        const num = crypto.randomInt(0, 1000000);
        return num.toString().padStart(6, '0');
    }

    /**
     * Compute validity window from visit times.
     * validFrom = plannedStartTimeUtc - earlyArrivalBuffer
     * validTo = plannedEndTimeUtc (or +24h if no end time)
     */
    private computeValidityWindow(visit: Visit): { validFrom: Date; validTo: Date } {
        const validFrom = new Date(visit.plannedStartTimeUtc.getTime() - EARLY_ARRIVAL_BUFFER_MINUTES * 60 * 1000);
        const validTo = visit.plannedEndTimeUtc
            ? new Date(visit.plannedEndTimeUtc)
            : new Date(visit.plannedStartTimeUtc.getTime() + 24 * 60 * 60 * 1000);
        return { validFrom, validTo };
    }

    // ── Generate for single visit-visitor ──

    async generateCodeForVisitVisitor(
        visitVisitorId: string,
        visitId: string,
        visitorId: string,
        visit: Visit,
        currentUserId?: string,
    ): Promise<VisitVisitorCheckInCode> {
        const { validFrom, validTo } = this.computeValidityWindow(visit);
        const code = await this.generateUniqueCode(validFrom, validTo);

        const checkInCode = this.codeRepo.create({
            visitVisitorId,
            visitId,
            visitorId,
            code,
            validFromUtc: validFrom,
            validToUtc: validTo,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });

        return this.codeRepo.save(checkInCode);
    }

    /**
     * Generate codes for all visitors in a visit (used during visit creation).
     * Runs inside existing transaction via queryRunner if provided.
     */
    async generateCodesForVisit(
        visitId: string,
        currentUserId?: string,
    ): Promise<VisitVisitorCheckInCode[]> {
        const visit = await this.visitRepo.findOne({ where: { id: visitId, isActive: true } });
        if (!visit) throw new NotFoundException('Visit not found');

        const visitVisitors = await this.visitVisitorRepo.find({
            where: { visitId, isActive: true },
        });

        const codes: VisitVisitorCheckInCode[] = [];
        for (const vv of visitVisitors) {
            // Skip if an active code already exists
            const existing = await this.codeRepo.findOne({
                where: { visitVisitorId: vv.id, isActive: true, usedAtUtc: undefined },
            });
            if (existing) {
                codes.push(existing);
                continue;
            }

            const code = await this.generateCodeForVisitVisitor(
                vv.id, visitId, vv.visitorId, visit, currentUserId,
            );
            codes.push(code);
        }

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'GENERATE_CHECK_IN_CODES',
            entity: 'Visit',
            entityId: visitId,
            description: `Generated ${codes.length} check-in codes for visit`,
            newValue: { codeCount: codes.length },
        }).catch(() => { });

        this.wsGateway.broadcastToAll('visits:check-in-code:generated', {
            visitId,
            count: codes.length,
        });

        return codes;
    }

    // ── Send notifications ──

    async sendCodeNotifications(
        visitId: string,
        currentUserId?: string,
    ): Promise<{ smsSent: number; emailSent: number }> {
        const visit = await this.visitRepo.findOne({ where: { id: visitId, isActive: true }, relations: ['visitRequesterUser'] });
        if (!visit) throw new NotFoundException('Visit not found');

        const codes = await this.codeRepo.find({
            where: { visitId, isActive: true },
        });

        let smsSent = 0;
        let emailSent = 0;

        for (const codeRecord of codes) {
            if (codeRecord.usedAtUtc) continue;

            const visitor = await this.visitorRepo.findOne({
                where: { id: codeRecord.visitorId, isActive: true },
            });
            if (!visitor) continue;

            const sent = await this.sendCodeToVisitor(codeRecord, visit, visitor, currentUserId);
            if (sent.sms) smsSent++;
            if (sent.email) emailSent++;
        }

        return { smsSent, emailSent };
    }

    private async sendCodeToVisitor(
        codeRecord: VisitVisitorCheckInCode,
        visit: Visit,
        visitor: Visitor,
        currentUserId?: string,
    ): Promise<{ sms: boolean; email: boolean }> {
        let smsSent = false;
        let emailSent = false;

        const templateData = {
            visit: {
                title: visit.title,
                startTime: visit.plannedStartTimeUtc?.toLocaleString('he-IL') ?? '',
                endTime: visit.plannedEndTimeUtc?.toLocaleString('he-IL') ?? '',
                hostName: visit.visitRequesterUser
                    ? [visit.visitRequesterUser.firstName, visit.visitRequesterUser.lastName].filter(Boolean).join(' ')
                    : [visit.visitRequesterFirstName, visit.visitRequesterLastName].filter(Boolean).join(' '),
                siteName: visit.siteId ?? '',
                purposeOfVisit: visit.purposeOfVisit ?? '',
            },
            visitor: {
                firstName: visitor.firstName,
                lastName: visitor.lastName,
                personId: visitor.personId,
                phone: visitor.phone ?? '',
                carNumber: visitor.carNumber ?? '',
                checkInCode: codeRecord.code,
            },
        };

        // Send SMS if visitor has phone
        if (visitor.phone) {
            try {
                await this.smsNotification.triggerSms(NotificationEvent.CheckInCodeSent, templateData);
                smsSent = true;
            } catch {
                this.logger.warn(`Failed to send check-in code SMS to visitor ${visitor.id}`);
            }
        }

        // Send email if visitor has email
        if (visitor.email) {
            try {
                await this.emailNotification.triggerEmail(NotificationEvent.CheckInCodeSent, templateData);
                emailSent = true;
            } catch {
                this.logger.warn(`Failed to send check-in code email to visitor ${visitor.id}`);
            }
        }

        // Update code record with send status
        codeRecord.sentBySms = codeRecord.sentBySms || smsSent;
        codeRecord.sentByEmail = codeRecord.sentByEmail || emailSent;
        codeRecord.lastSentAtUtc = new Date();
        codeRecord.updatedBy = currentUserId ?? null;
        await this.codeRepo.save(codeRecord);

        return { sms: smsSent, email: emailSent };
    }

    // ── Kiosk validation & check-in ──

    async validateCode(code: string): Promise<{
        valid: boolean;
        visitVisitorId?: string;
        visitorName?: string;
        visitTitle?: string;
    }> {
        const now = new Date();
        const codeRecord = await this.codeRepo
            .createQueryBuilder('c')
            .where('c.code = :code', { code })
            .andWhere('c.isActive = :active', { active: true })
            .andWhere('c.usedAtUtc IS NULL')
            .andWhere('c.validFromUtc <= :now', { now })
            .andWhere('c.validToUtc >= :now', { now })
            .getOne();

        if (!codeRecord) {
            return { valid: false };
        }

        const visitor = await this.visitorRepo.findOne({ where: { id: codeRecord.visitorId } });
        const visit = await this.visitRepo.findOne({ where: { id: codeRecord.visitId } });

        return {
            valid: true,
            visitVisitorId: codeRecord.visitVisitorId,
            visitorName: visitor ? `${visitor.firstName} ${visitor.lastName}` : undefined,
            visitTitle: visit?.title,
        };
    }

    async findVisitByPersonId(personId: string) {
        const trimmed = personId.trim();
        if (!trimmed) return { ok: false };

        const visitor = await this.visitorRepo.findOne({
            where: { personId: trimmed, isActive: true },
        });
        if (!visitor) return { ok: false };

        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const visitVisitor = await this.visitVisitorRepo
            .createQueryBuilder('vv')
            .innerJoinAndSelect('vv.visit', 'visit')
            .leftJoinAndSelect('vv.status', 'status')
            .where('vv.visitorId = :visitorId', { visitorId: visitor.id })
            .andWhere('vv.isActive = :active', { active: true })
            .andWhere('visit.isActive = :active', { active: true })
            .andWhere('visit.plannedStartTimeUtc <= :endOfDay', { endOfDay })
            .andWhere('(visit.plannedEndTimeUtc >= :startOfDay OR visit.plannedEndTimeUtc IS NULL)', { startOfDay })
            .orderBy('visit.plannedStartTimeUtc', 'DESC')
            .getOne();

        if (!visitVisitor) return { ok: false };

        const visit = visitVisitor.visit;

        return {
            ok: true,
            visit: {
                visitId: visit.id,
                visitName: visit.title,
                fromDate: visit.plannedStartTimeUtc?.toISOString() ?? null,
                toDate: visit.plannedEndTimeUtc?.toISOString() ?? null,
                siteId: visit.siteId,
                departmentId: visit.sectorId,
                visitorType: null,
                driverType: null,
                comment: visit.purposeOfVisit,
                isExternal: false,
            },
            visitor: {
                visitorId: visitor.id,
                visitId: visit.id,
                firstName: visitor.firstName,
                lastName: visitor.lastName,
                personId: visitor.personId,
                carNumber: visitor.carNumber,
                accessLevelId: null,
                visitCode: null,
                phone: visitor.phone,
                email: visitor.email,
                image: null,
                checkInTime: visitVisitor.status?.checkedInAtUtc?.toISOString() ?? null,
                checkOutTime: visitVisitor.status?.checkedOutAtUtc?.toISOString() ?? null,
                rejectDate: null,
                approveDate: null,
                visitorStatus: visitVisitor.status?.currentStatus ?? 0,
            },
        };
    }

    async consumeCodeAndCheckIn(code: string): Promise<{
        visitVisitorId: string;
        visitorName: string;
        visitTitle: string;
    }> {
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction('SERIALIZABLE');

        try {
            const now = new Date();

            // Find and lock the code record
            const codeRecord = await qr.manager
                .createQueryBuilder(VisitVisitorCheckInCode, 'c')
                .setLock('pessimistic_write')
                .where('c.code = :code', { code })
                .andWhere('c.isActive = :active', { active: true })
                .andWhere('c.usedAtUtc IS NULL')
                .andWhere('c.validFromUtc <= :now', { now })
                .andWhere('c.validToUtc >= :now', { now })
                .getOne();

            if (!codeRecord) {
                throw new BadRequestException('Invalid or expired check-in code');
            }

            // Mark code as used
            codeRecord.usedAtUtc = now;
            codeRecord.updatedAt = now;
            await qr.manager.save(codeRecord);

            // Update VisitVisitorStatus
            const status = await qr.manager.findOne(VisitVisitorStatus, {
                where: { visitVisitorId: codeRecord.visitVisitorId },
            });
            if (status) {
                status.currentStatus = VisitorStatus.CheckedIn;
                status.arrivedAtUtc = now;
                status.checkedInAtUtc = now;
                status.lastEventTimeUtc = now;
                status.updatedAt = now;
                await qr.manager.save(status);
            }

            await qr.commitTransaction();

            // Fetch names for response
            const visitor = await this.visitorRepo.findOne({ where: { id: codeRecord.visitorId } });
            const visit = await this.visitRepo.findOne({ where: { id: codeRecord.visitId } });
            const visitorName = visitor ? `${visitor.firstName} ${visitor.lastName}` : 'Unknown';
            const visitTitle = visit?.title ?? 'Unknown';

            // Broadcast check-in event
            this.wsGateway.broadcastToAll('visits:visitor:self-checked-in', {
                visitId: codeRecord.visitId,
                visitVisitorId: codeRecord.visitVisitorId,
                visitorName,
            });

            this.auditService.log({
                module: 'visitors',
                action: 'KIOSK_CHECK_IN',
                entity: 'VisitVisitor',
                entityId: codeRecord.visitVisitorId,
                description: `Visitor "${visitorName}" self-checked-in via kiosk for visit "${visitTitle}"`,
                newValue: { visitId: codeRecord.visitId, code: codeRecord.code },
            }).catch(() => { });

            return { visitVisitorId: codeRecord.visitVisitorId, visitorName, visitTitle };
        } catch (err) {
            await qr.rollbackTransaction();
            throw err;
        } finally {
            await qr.release();
        }
    }

    // ── Resend / Regenerate ──

    async resendCode(visitVisitorId: string, currentUserId?: string): Promise<{ sent: boolean }> {
        const codeRecord = await this.codeRepo.findOne({
            where: { visitVisitorId, isActive: true },
            order: { createdAt: 'DESC' },
        });
        if (!codeRecord) throw new NotFoundException('No active check-in code found');
        if (codeRecord.usedAtUtc) throw new BadRequestException('Code has already been used');

        const now = new Date();
        if (codeRecord.validToUtc < now) throw new BadRequestException('Code has expired');

        const visit = await this.visitRepo.findOne({ where: { id: codeRecord.visitId, isActive: true }, relations: ['visitRequesterUser'] });
        if (!visit) throw new NotFoundException('Visit not found');

        const visitor = await this.visitorRepo.findOne({ where: { id: codeRecord.visitorId, isActive: true } });
        if (!visitor) throw new NotFoundException('Visitor not found');

        const sent = await this.sendCodeToVisitor(codeRecord, visit, visitor, currentUserId);

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'RESEND_CHECK_IN_CODE',
            entity: 'VisitVisitor',
            entityId: visitVisitorId,
            description: `Resent check-in code to visitor "${visitor.firstName} ${visitor.lastName}"`,
            metadata: { code: codeRecord.code, smsSent: sent.sms, emailSent: sent.email },
        }).catch(() => { });

        return { sent: sent.sms || sent.email };
    }

    async regenerateCode(visitVisitorId: string, currentUserId?: string): Promise<VisitVisitorCheckInCode> {
        const vv = await this.visitVisitorRepo.findOne({
            where: { id: visitVisitorId, isActive: true },
        });
        if (!vv) throw new NotFoundException('Visit visitor not found');

        const visit = await this.visitRepo.findOne({ where: { id: vv.visitId, isActive: true }, relations: ['visitRequesterUser'] });
        if (!visit) throw new NotFoundException('Visit not found');

        // Deactivate all existing active codes for this visit-visitor
        await this.codeRepo
            .createQueryBuilder()
            .update(VisitVisitorCheckInCode)
            .set({ isActive: false, updatedBy: currentUserId ?? null })
            .where('visitVisitorId = :visitVisitorId', { visitVisitorId })
            .andWhere('isActive = :active', { active: true })
            .execute();

        // Generate new code
        const newCode = await this.generateCodeForVisitVisitor(
            visitVisitorId, vv.visitId, vv.visitorId, visit, currentUserId,
        );

        // Send notification for new code
        const visitor = await this.visitorRepo.findOne({ where: { id: vv.visitorId, isActive: true } });
        if (visitor) {
            await this.sendCodeToVisitor(newCode, visit, visitor, currentUserId);
        }

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'REGENERATE_CHECK_IN_CODE',
            entity: 'VisitVisitor',
            entityId: visitVisitorId,
            description: `Regenerated check-in code for visitor`,
            newValue: { newCode: newCode.code },
        }).catch(() => { });

        this.wsGateway.broadcastToAll('visits:check-in-code:regenerated', {
            visitId: vv.visitId,
            visitVisitorId,
        });

        return newCode;
    }

    // ── Query helpers ──

    async getCodesForVisit(visitId: string): Promise<VisitVisitorCheckInCode[]> {
        return this.codeRepo.find({
            where: { visitId },
            order: { createdAt: 'DESC' },
        });
    }

    async getActiveCodeForVisitVisitor(visitVisitorId: string): Promise<VisitVisitorCheckInCode | null> {
        return this.codeRepo.findOne({
            where: { visitVisitorId, isActive: true },
            order: { createdAt: 'DESC' },
        });
    }
}
