import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, MoreThan, And } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
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
import { BlacklistOverrideRequest } from './entities/blacklist-override-request.entity';
import { BlacklistOverrideStatus } from './enums/blacklist-override-status.enum';
import { BlacklistService } from './blacklist.service';
import { AmadeusUsersService } from '../amadeus/services/amadeus-users.service';
import { SyncQueueSource } from '../amadeus/entities/amadeus-sync-queue.entity';
import { PrintingService } from '../printing/services/printing.service';
import { Building } from '../buildings/entities/building.entity';
import { buildSmsData } from './visit.utils';
import { ErrorMessages } from '../common/constants/error-messages.constants';

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
        @InjectRepository(Building)
        private readonly buildingRepo: Repository<Building>,
        private readonly dataSource: DataSource,
        private readonly wsGateway: UsersGateway,
        private readonly smsNotification: SmsNotificationService,
        private readonly emailNotification: EmailNotificationService,
        private readonly auditService: AuditService,
        private readonly amadeusUsersService: AmadeusUsersService,
        private readonly printingService: PrintingService,
        private readonly blacklistService: BlacklistService,
        @InjectRepository(BlacklistOverrideRequest)
        private readonly overrideRepo: Repository<BlacklistOverrideRequest>,
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
                hostName: [visit.visitRequesterUser?.firstName, visit.visitRequesterUser?.lastName].filter(Boolean).join(' '),
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

    // ── Kiosk validation & arrive ──

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

    async findVisitByPersonId(personId: string, identifyNumber?: string) {
        const trimmed = personId.trim();
        if (!trimmed) return { ok: false };

        let visitor = await this.visitorRepo.findOne({
            where: { personId: trimmed, isActive: true },
        });

        // Fallback: try digits-only version (MRZ may include filler chars like '<')
        if (!visitor) {
            const digitsOnly = trimmed.replace(/\D/g, '');
            if (digitsOnly && digitsOnly !== trimmed) {
                visitor = await this.visitorRepo.findOne({
                    where: { personId: digitsOnly, isActive: true },
                });
            }
        }

        // Fallback: try the identifyNumber field (Israeli ID from OCR)
        if (!visitor && identifyNumber) {
            const trimmedIdentify = identifyNumber.trim();
            if (trimmedIdentify) {
                visitor = await this.visitorRepo.findOne({
                    where: { personId: trimmedIdentify, isActive: true },
                });
            }
        }

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

        // Validate visit time window (date + time-of-day)
        try {
            this.validateVisitTimeWindow(visit);
        } catch (err) {
            this.logger.warn(`Visit time validation failed for visitor personId=${trimmed}: ${(err as Error).message}`);
            return { ok: false, reason: (err as BadRequestException).message };
        }

        // ── Blacklist + escort-status check ──
        // If the visitor is blacklisted, only allow through if the override is
        // approved with regular escort (Approved / ApprovedEscort).
        // Security escort or non-approved → redirect to front desk.
        const blacklistCheck = await this.blacklistService.checkBlacklistStatus(visitor.personId);
        if (blacklistCheck.isBlacklisted) {
            const override = await this.overrideRepo.findOne({
                where: { visitVisitorId: visitVisitor.id, isActive: true },
                order: { createdAt: 'DESC' },
            });

            const allowedStatuses: BlacklistOverrideStatus[] = [
                BlacklistOverrideStatus.Approved,
                BlacklistOverrideStatus.ApprovedEscort,
            ];

            if (!override || !allowedStatuses.includes(override.status)) {
                this.logger.warn(
                    `Blacklisted visitor blocked at kiosk: personId=${visitor.personId}, overrideStatus=${override?.status ?? 'none'}`,
                );
                return { ok: false };
            }
        }

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

    async arriveByPersonId(visitId: string, visitorId: string, personId: string, file?: Express.Multer.File, workstationCode?: string) {
        const visitor = await this.visitorRepo.findOne({
            where: { id: visitorId, personId: personId.trim(), isActive: true },
        });
        if (!visitor) throw new BadRequestException('Visitor not found');

        const visitVisitor = await this.visitVisitorRepo.findOne({
            where: { visitId, visitorId, isActive: true },
            relations: ['visit', 'visit.visitRequesterUser'],
        });
        if (!visitVisitor) throw new BadRequestException('Visitor is not part of this visit');

        // Validate visit time window with grace period — visitor already passed
        // strict validation at scan time and is physically present at the kiosk
        this.validateVisitTimeWindow(visitVisitor.visit, 15);

        // Save consent PDF if provided
        if (file) {
            const uploadDir = path.join(process.cwd(), 'uploads', 'consent-pdfs');
            fs.mkdirSync(uploadDir, { recursive: true });
            const filename = `${visitVisitor.id}_${Date.now()}.pdf`;
            fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
        }

        const now = new Date();

        // Update or create status
        let status = await this.statusRepo.findOne({
            where: { visitVisitorId: visitVisitor.id },
        });
        if (status) {
            status.currentStatus = VisitorStatus.Arrived;
            status.arrivedAtUtc = status.arrivedAtUtc ?? now;
            status.lastEventTimeUtc = now;
            status.updatedAt = now;
            await this.statusRepo.save(status);
        } else {
            status = this.statusRepo.create({
                visitVisitorId: visitVisitor.id,
                visitId,
                visitorId,
                currentStatus: VisitorStatus.Arrived,
                arrivedAtUtc: now,
                lastEventTimeUtc: now,
            });
            await this.statusRepo.save(status);
        }

        const visitorName = `${visitor.firstName} ${visitor.lastName}`;
        const visitTitle = visitVisitor.visit?.title ?? 'Unknown';

        // Send arrival notifications to host (fire-and-forget)
        if (visitVisitor.visit) {
            const smsData = buildSmsData(visitVisitor.visit, visitor);
            this.smsNotification.triggerSms(NotificationEvent.VisitorArrived, smsData).catch(() => {});
            this.emailNotification.triggerEmail(NotificationEvent.VisitorArrived, smsData).catch(() => {});
        }

        this.wsGateway.broadcastToAll('visits:visitor:arrived', {
            visitId,
            visitVisitorId: visitVisitor.id,
            visitorName,
        });

        // Dispatch the card print to the workstation's printer agent. A printer problem
        // must never fail the check-in itself — the kiosk gets print progress over
        // /ws/kiosk, and `print: null` here just means nothing was dispatched.
        let print: { ok: true; correlationId: string; status: 'queued' } | null = null;
        if (workstationCode) {
            try {
                print = await this.printingService.requestKioskPrintCard(workstationCode, visitId, visitorId);
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                this.logger.error(`Failed to dispatch kiosk card print: ${error.message}`, error.stack);
                print = null;
            }
        }

        this.auditService.log({
            module: 'visitors',
            action: 'KIOSK_ARRIVED',
            entity: 'VisitVisitor',
            entityId: visitVisitor.id,
            description: `Visitor "${visitorName}" arrived via kiosk scan for visit "${visitTitle}"`,
            newValue: { visitId, personId },
        }).catch(() => { });

        return { ok: true, visitVisitorId: visitVisitor.id, visitorName, visitTitle, print };
    }

    async consumeCodeAndArrive(code: string): Promise<{
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

            // Block check-in for visitors with pending blacklist override
            const pendingOverride = await qr.manager.findOne(BlacklistOverrideRequest, {
                where: [
                    { visitVisitorId: codeRecord.visitVisitorId, status: BlacklistOverrideStatus.Pending, isActive: true },
                    { visitVisitorId: codeRecord.visitVisitorId, status: BlacklistOverrideStatus.ApprovedSecurity, isActive: true },
                ],
            });
            if (pendingOverride) {
                const message = pendingOverride.status === BlacklistOverrideStatus.ApprovedSecurity
                    ? 'Please proceed to the front desk for security escort'
                    : 'Cannot check in — visitor has a pending blacklist override approval';
                throw new ForbiddenException(message);
            }

            // Validate visit time window (date + time-of-day)
            const visitForValidation = await qr.manager.findOne(Visit, { where: { id: codeRecord.visitId } });
            if (visitForValidation) {
                this.validateVisitTimeWindow(visitForValidation);
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
                status.currentStatus = VisitorStatus.Arrived;
                status.arrivedAtUtc = now;
                status.lastEventTimeUtc = now;
                status.updatedAt = now;
                await qr.manager.save(status);
            }

            await qr.commitTransaction();

            // Fetch names for response
            const visitor = await this.visitorRepo.findOne({ where: { id: codeRecord.visitorId } });
            const visit = await this.visitRepo.findOne({ where: { id: codeRecord.visitId }, relations: ['visitRequesterUser'] });
            const visitorName = visitor ? `${visitor.firstName} ${visitor.lastName}` : 'Unknown';
            const visitTitle = visit?.title ?? 'Unknown';

            // Send arrival notifications to host (fire-and-forget)
            if (visit && visitor) {
                const smsData = buildSmsData(visit, visitor);
                this.smsNotification.triggerSms(NotificationEvent.VisitorArrived, smsData).catch(() => {});
                this.emailNotification.triggerEmail(NotificationEvent.VisitorArrived, smsData).catch(() => {});
            }

            // Download visitor to Amadeus
            if (visitor && visit) {
                try {
                    await this.downloadVisitorToAmadeus(visitor, visit);
                } catch (err: any) {
                    this.logger.error(`Failed to download visitor to Amadeus: ${err.message}`, err.stack);
                }
            }

            // Broadcast arrived event
            this.wsGateway.broadcastToAll('visits:visitor:arrived', {
                visitId: codeRecord.visitId,
                visitVisitorId: codeRecord.visitVisitorId,
                visitorName,
            });

            this.auditService.log({
                module: 'visitors',
                action: 'KIOSK_ARRIVED',
                entity: 'VisitVisitor',
                entityId: codeRecord.visitVisitorId,
                description: `Visitor "${visitorName}" arrived via kiosk for visit "${visitTitle}"`,
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

    // ── Amadeus download ──

    private async downloadVisitorToAmadeus(visitor: Visitor, visit: Visit): Promise<void> {
        if (!visit.buildingId) {
            this.logger.warn(`Visit ${visit.id} has no building — skipping Amadeus download`);
            return;
        }

        const building = await this.buildingRepo.findOne({
            where: { id: visit.buildingId, isActive: true },
            relations: ['accessLevels'],
        });

        const accessLevelApiKeys = (building?.accessLevels ?? [])
            .filter((al) => al.isActive && al.active && al.visitorAccess && al.externalId)
            .map((al) => al.externalId!);

        const result = await this.amadeusUsersService.addUserToAmadeus({
            cardholderIdNumber: visitor.personId,
            firstName: visitor.firstName,
            lastName: visitor.lastName,
            accessGroupApiKeys: accessLevelApiKeys,
            fromDateValid: visit.plannedStartTimeUtc?.toISOString(),
            toDateValid: visit.plannedEndTimeUtc?.toISOString() ?? undefined,
        }, {
            source: SyncQueueSource.VisitorCheckIn,
            referenceId: visit.id,
            referenceType: 'Visit',
        });

        if (result.queued) {
            this.logger.warn(`Visitor ${visitor.personId} queued for Amadeus sync (service unavailable)`);
        } else {
            this.logger.log(`Visitor ${visitor.personId} downloaded to Amadeus: ${result?.cardholderId}`);
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

    // ── Visit Time Validation ──

    /**
     * Validates that the current date and time-of-day fall within the visit's planned window.
     *
     * Date check: today must be between start date and end date (inclusive).
     * Time check: current HH:mm must be between start HH:mm and end HH:mm (inclusive),
     *             extracted from plannedStartTimeUtc and plannedEndTimeUtc.
     */
    private validateVisitTimeWindow(visit: Visit, graceMinutes = 0): void {
        const now = new Date();
        const plannedStart = visit.plannedStartTimeUtc;
        const plannedEnd = visit.plannedEndTimeUtc;

        this.logger.debug(
            `Validating visit time window: visitId=${visit.id}, now=${now.toISOString()}, ` +
            `start=${plannedStart?.toISOString() ?? 'null'}, end=${plannedEnd?.toISOString() ?? 'null'}`,
        );

        if (!plannedStart) {
            this.logger.warn(`Visit ${visit.id} has no plannedStartTimeUtc — skipping time validation`);
            return;
        }

        // ── 1. Date validation: today must be within the invitation date range ──
        const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startDate = new Date(plannedStart.getFullYear(), plannedStart.getMonth(), plannedStart.getDate());

        if (todayDate < startDate) {
            this.logger.warn(`Visit ${visit.id} has not started yet. Today=${todayDate.toISOString()}, startDate=${startDate.toISOString()}`);
            throw new BadRequestException(ErrorMessages.VISIT_NOT_STARTED);
        }

        if (plannedEnd) {
            const endDate = new Date(plannedEnd.getFullYear(), plannedEnd.getMonth(), plannedEnd.getDate());
            if (todayDate > endDate) {
                this.logger.warn(`Visit ${visit.id} has expired. Today=${todayDate.toISOString()}, endDate=${endDate.toISOString()}`);
                throw new BadRequestException(ErrorMessages.VISIT_EXPIRED);
            }
        }

        // ── 2. Time-of-day validation: current HH:mm must be between start HH:mm and end HH:mm ──
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = plannedStart.getHours() * 60 + plannedStart.getMinutes();

        if (currentMinutes < startMinutes - graceMinutes) {
            this.logger.warn(
                `Visit ${visit.id} time not yet valid. Current=${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}, ` +
                `start=${plannedStart.getHours()}:${String(plannedStart.getMinutes()).padStart(2, '0')}`,
            );
            throw new BadRequestException(ErrorMessages.VISIT_TIME_NOT_VALID);
        }

        if (plannedEnd) {
            const endMinutes = plannedEnd.getHours() * 60 + plannedEnd.getMinutes();
            if (currentMinutes > endMinutes + graceMinutes) {
                this.logger.warn(
                    `Visit ${visit.id} time has passed. Current=${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}, ` +
                    `end=${plannedEnd.getHours()}:${String(plannedEnd.getMinutes()).padStart(2, '0')}`,
                );
                throw new BadRequestException(ErrorMessages.VISIT_TIME_NOT_VALID);
            }
        }

        this.logger.debug(`Visit ${visit.id} time validation passed`);
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
