import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Door } from '../../access-control/entities/door.entity';
import { EntryType } from '../../access-control/enums/io-type.enum';
import { CardholderService } from '../../access-control/services/cardholder.service';
import { SettingsService } from '../../settings/settings.service';
import { UserBadge } from '../../users/entities/user-badge.entity';
import { PermanentEscort } from '../../settings/entities/permanent-escort.entity';
import { Visitor } from '../../visitors/entities/visitor.entity';
import { VisitVisitor } from '../../visitors/entities/visit-visitor.entity';
import { VisitVisitorStatus } from '../../visitors/entities/visit-visitor-status.entity';
import { Visit } from '../../visitors/entities/visit.entity';
import { VisitEscort } from '../../visitors/entities/visit-escort.entity';
import { VisitorStatus } from '../../visitors/enums/visitor-status.enum';
import { EscortGuestPairing } from '../../visitors/entities/escort-guest-pairing.entity';
import { EscortGuestPairingStatus } from '../../visitors/enums/escort-guest-pairing-status.enum';
import { UsersGateway } from '../../websocket/gateways/users.gateway';
import { WsEvent } from '../../websocket/enums/ws-events.enum';

interface PendingEscort {
    escortUserId: string;
    timeoutHandle: ReturnType<typeof setTimeout>;
}

/**
 * Correlates an escort's badge swipe with a guest's QR swipe at a co-located
 * reader pair on an escort-designated door, then activates the guest's
 * Amadeus card and tracks the pairing until the escort exits.
 */
@Injectable()
export class EscortGuestPairingService {
    private readonly logger = new Logger(EscortGuestPairingService.name);

    // In-memory: doorId -> escort awaiting a matching guest QR swipe.
    private readonly pendingByDoor = new Map<string, PendingEscort>();

    // Used only if the 'visitors.escortPairingWindowSeconds' setting is missing or invalid.
    private static readonly DEFAULT_PAIRING_WINDOW_MS = 8_000;
    private static readonly PAIRING_WINDOW_SETTING_KEY = 'visitors.escortPairingWindowSeconds';

    constructor(
        @InjectRepository(Door)
        private readonly doorRepo: Repository<Door>,
        @InjectRepository(UserBadge)
        private readonly userBadgeRepo: Repository<UserBadge>,
        @InjectRepository(PermanentEscort)
        private readonly permanentEscortRepo: Repository<PermanentEscort>,
        @InjectRepository(VisitEscort)
        private readonly visitEscortRepo: Repository<VisitEscort>,
        @InjectRepository(Visitor)
        private readonly visitorRepo: Repository<Visitor>,
        @InjectRepository(VisitVisitor)
        private readonly visitVisitorRepo: Repository<VisitVisitor>,
        @InjectRepository(VisitVisitorStatus)
        private readonly statusRepo: Repository<VisitVisitorStatus>,
        @InjectRepository(EscortGuestPairing)
        private readonly pairingRepo: Repository<EscortGuestPairing>,
        private readonly cardholderService: CardholderService,
        private readonly wsGateway: UsersGateway,
        private readonly settingsService: SettingsService,
    ) { }

    /**
     * Entry point from the Amadeus event pipeline. Only acts on events at
     * doors explicitly marked forEscort; everything else is a no-op.
     */
    async handleAmadeusEvent(payload: Record<string, unknown>): Promise<void> {
        const readerUid = this.asString(payload.readerUid) ?? this.asString(payload.objectExternalId);
        if (!readerUid) {
            this.logger.debug('Amadeus event received with no readerUid/objectExternalId on payload — ignoring');
            return;
        }

        const door = await this.doorRepo.findOne({
            where: [
                { badgeReaderExternalId: readerUid, isActive: true },
                { qrReaderExternalId: readerUid, isActive: true },
            ],
        });
        if (!door) {
            this.logger.debug(`No active door found for reader ${readerUid} — ignoring`);
            return;
        }
        if (!door.forEscort) {
            this.logger.debug(`Door ${door.id} (reader ${readerUid}) is not escort-designated — ignoring`);
            return;
        }

        const isBadgeReader = door.badgeReaderExternalId === readerUid;
        const isQrReader = !isBadgeReader && door.qrReaderExternalId === readerUid;

        if (isBadgeReader) {
            this.logger.debug(`Badge reader event at escort door ${door.id}`);
            await this.handleBadgeEvent(door, payload);
        } else if (isQrReader) {
            this.logger.debug(`QR reader event at escort door ${door.id}`);
            await this.handleQrEvent(door, payload);
        }
    }

    private async handleBadgeEvent(door: Door, payload: Record<string, unknown>): Promise<void> {
        const cardholderUid = this.asString(payload.cardholderUid);
        if (!cardholderUid) {
            this.logger.debug(`Badge event at door ${door.id} missing cardholderUid — ignoring`);
            return;
        }

        const badge = await this.userBadgeRepo.findOne({
            where: { amadeusCardholderUid: cardholderUid, isActive: true },
        });
        if (!badge) {
            this.logger.debug(`No active user badge found for cardholder ${cardholderUid} at door ${door.id} — ignoring`);
            return;
        }

        // Coarse gate: this person must be *some* kind of escort (permanent, or
        // named on at least one visit) before we bother opening a pairing window.
        // Whether they're the right escort *for this guest's visit* is checked
        // once the guest's QR swipe resolves which visit is involved.
        if (!(await this.isEscortCandidate(badge.userId))) {
            this.logger.debug(`User ${badge.userId} is not a permanent escort or active visit escort — ignoring badge at door ${door.id}`);
            return;
        }

        if (door.entryType === EntryType.IN) {
            this.logger.debug(`Escort ${badge.userId} badge-in at door ${door.id} — opening pairing window`);
            await this.openPairingWindow(door.id, badge.userId);
        } else if (door.entryType === EntryType.OUT) {
            this.logger.debug(`Escort ${badge.userId} badge-out at door ${door.id} — attempting pairing release`);
            await this.releasePairing(badge.userId);
        } else {
            this.logger.debug(`Escort ${badge.userId} badged at door ${door.id} with unhandled entryType ${door.entryType} — ignoring`);
        }
    }

    private async isEscortCandidate(userId: string): Promise<boolean> {
        const permanentEscort = await this.permanentEscortRepo.findOne({ where: { userId } });
        if (permanentEscort) return true;

        const visitEscort = await this.visitEscortRepo.findOne({ where: { userId, isActive: true } });
        return !!visitEscort;
    }

    /**
     * A badge swipe only completes a pairing if the escort is either explicitly
     * named as an escort on this specific visit, or is a permanent escort from
     * the same sector/domain as the visit.
     */
    private async isEscortAuthorizedForVisit(escortUserId: string, visit: Visit): Promise<boolean> {
        const invitedEscort = await this.visitEscortRepo.findOne({
            where: { visitId: visit.id, userId: escortUserId, isActive: true },
        });
        if (invitedEscort) return true;

        const permanentEscort = await this.permanentEscortRepo.findOne({
            where: { userId: escortUserId },
            relations: ['user'],
        });

        return !!(permanentEscort && visit.sectorId && permanentEscort.user.sectorId === visit.sectorId);
    }

    private async openPairingWindow(doorId: string, escortUserId: string): Promise<void> {
        const existing = this.pendingByDoor.get(doorId);
        if (existing) clearTimeout(existing.timeoutHandle);

        const windowMs = await this.getPairingWindowMs();

        const timeoutHandle = setTimeout(() => {
            this.pendingByDoor.delete(doorId);
            this.logger.warn(`Escort badge at door ${doorId} timed out waiting for a guest QR swipe (escort ${escortUserId})`);
        }, windowMs);

        this.pendingByDoor.set(doorId, { escortUserId, timeoutHandle });
        this.logger.log(`Escort ${escortUserId} badged at door ${doorId}, awaiting guest QR within ${windowMs}ms`);
    }

    /** Reads the admin-configurable pairing window (falls back to a default if unset/invalid). */
    private async getPairingWindowMs(): Promise<number> {
        const raw = await this.settingsService.getValue(EscortGuestPairingService.PAIRING_WINDOW_SETTING_KEY);
        const seconds = raw ? Number(raw) : NaN;
        return Number.isFinite(seconds) && seconds > 0
            ? seconds * 1000
            : EscortGuestPairingService.DEFAULT_PAIRING_WINDOW_MS;
    }

    private async handleQrEvent(door: Door, payload: Record<string, unknown>): Promise<void> {
        const pending = this.pendingByDoor.get(door.id);
        if (!pending) {
            this.logger.debug(`Guest QR swipe at door ${door.id} with no pending escort badge — ignoring`);
            return;
        }

        const personId = this.asString(payload.cardCode);
        if (!personId) {
            this.logger.debug(`Guest QR swipe at door ${door.id} missing cardCode — ignoring`);
            return;
        }

        const visitor = await this.visitorRepo.findOne({ where: { personId, isActive: true } });
        if (!visitor) {
            this.logger.warn(`No active visitor found for personId ${personId} at door ${door.id} — pairing aborted`);
            return;
        }

        const visitVisitor = await this.visitVisitorRepo
            .createQueryBuilder('vv')
            .leftJoinAndSelect('vv.status', 'status')
            .leftJoinAndSelect('vv.visit', 'visit')
            .where('vv.visitorId = :visitorId', { visitorId: visitor.id })
            .andWhere('vv.isActive = :active', { active: true })
            .andWhere('status.currentStatus IN (:...statuses)', {
                statuses: [VisitorStatus.Arrived, VisitorStatus.CheckedIn],
            })
            .orderBy('status.arrivedAtUtc', 'DESC')
            .getOne();
        if (!visitVisitor) {
            this.logger.warn(
                `No visit found with status Arrived/CheckedIn for visitor ${visitor.personId} at door ${door.id} — pairing aborted`,
            );
            return;
        }

        this.logger.debug(
            `Matched guest ${visitor.personId} on visit ${visitVisitor.visit.id} to pending escort ${pending.escortUserId} — checking authorization`,
        );

        const authorized = await this.isEscortAuthorizedForVisit(pending.escortUserId, visitVisitor.visit);
        if (!authorized) {
            this.logger.warn(
                `Escort ${pending.escortUserId} is not an invited escort on visit ${visitVisitor.visit.id} ` +
                `and is not a permanent escort from its sector — pairing with guest ${visitor.personId} rejected`,
            );
            clearTimeout(pending.timeoutHandle);
            this.pendingByDoor.delete(door.id);
            return;
        }

        clearTimeout(pending.timeoutHandle);
        this.pendingByDoor.delete(door.id);

        const now = new Date();
        const pairing = this.pairingRepo.create({
            visitVisitorId: visitVisitor.id,
            escortUserId: pending.escortUserId,
            doorId: door.id,
            status: EscortGuestPairingStatus.CardActivated,
            pairedAtUtc: now,
        });
        await this.pairingRepo.save(pairing);

        this.logger.log(
            `Paired escort ${pending.escortUserId} with guest ${visitor.personId} at door ${door.id}`,
        );

        this.wsGateway.broadcastToAll(WsEvent.VisitsEscortGuestPaired, {
            visitVisitorId: visitVisitor.id,
            escortUserId: pending.escortUserId,
            doorId: door.id,
        });

        const activation = await this.cardholderService.activateVisitorCard(visitor.personId);
        if (activation.success) {
            const status = visitVisitor.status;
            status.currentStatus = VisitorStatus.CheckedIn;
            status.checkedInAtUtc = status.checkedInAtUtc ?? now;
            status.lastEventTimeUtc = now;
            status.updatedAt = now;
            await this.statusRepo.save(status);

            this.logger.log(
                `Visitor ${visitor.personId} status set to CheckedIn after successful escort pairing (visitVisitor ${visitVisitor.id})`,
            );

            this.wsGateway.broadcastToAll(WsEvent.VisitsGuestCardActivated, {
                visitVisitorId: visitVisitor.id,
                personId: visitor.personId,
            });
            this.wsGateway.broadcastToAll(WsEvent.VisitorsVisitorCheckedIn, {
                visitVisitorId: visitVisitor.id,
                personId: visitor.personId,
            });
        } else {
            this.logger.error(
                `Failed to activate Amadeus card for visitor ${visitor.personId}: ${activation.message ?? 'Unknown error'}`,
            );
        }
    }

    private async releasePairing(escortUserId: string): Promise<void> {
        const pairing = await this.pairingRepo.findOne({
            where: { escortUserId, status: EscortGuestPairingStatus.CardActivated, isActive: true },
            order: { pairedAtUtc: 'DESC' },
        });
        if (!pairing) {
            this.logger.debug(`Escort ${escortUserId} badged out but has no active pairing — nothing to release`);
            return;
        }

        const now = new Date();
        pairing.status = EscortGuestPairingStatus.Released;
        pairing.releasedAtUtc = now;
        await this.pairingRepo.save(pairing);

        const status = await this.statusRepo.findOne({ where: { visitVisitorId: pairing.visitVisitorId } });
        if (status) {
            status.currentStatus = VisitorStatus.CheckedOut;
            status.checkedOutAtUtc = status.checkedOutAtUtc ?? now;
            status.lastEventTimeUtc = now;
            status.updatedAt = now;
            await this.statusRepo.save(status);
        }

        this.logger.log(`Released escort ${escortUserId} pairing for visitVisitor ${pairing.visitVisitorId}`);

        this.wsGateway.broadcastToAll(WsEvent.VisitsEscortReleased, {
            visitVisitorId: pairing.visitVisitorId,
            escortUserId,
        });
    }

    private asString(value: unknown): string | null {
        return typeof value === 'string' && value.trim() ? value : null;
    }
}
