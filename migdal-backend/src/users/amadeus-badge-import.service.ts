import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserBadge } from './entities/user-badge.entity';
import { AccessControlApiService, RemoteCardDto } from '../access-control/services/ac-api.service';

export interface BadgeImportResult {
    totalCards: number;
    matchedUsers: number;
    badgesCreated: number;
    badgesUpdated: number;
    badgesDeactivated: number;
    skippedNoIdNumber: number;
    skippedNoMatchingUser: number;
    skippedDuplicateIdNumber: number;
    errors: string[];
}

const INACTIVE_STATUSES = new Set(['disabled', 'lost', 'expired', 'stolen']);

@Injectable()
export class AmadeusBadgeImportService {
    private readonly logger = new Logger(AmadeusBadgeImportService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(UserBadge)
        private readonly badgeRepo: Repository<UserBadge>,
        private readonly acApi: AccessControlApiService,
    ) {}

    async importBadgesFromAmadeus(currentUserId?: string): Promise<BadgeImportResult> {
        const result: BadgeImportResult = {
            totalCards: 0,
            matchedUsers: 0,
            badgesCreated: 0,
            badgesUpdated: 0,
            badgesDeactivated: 0,
            skippedNoIdNumber: 0,
            skippedNoMatchingUser: 0,
            skippedDuplicateIdNumber: 0,
            errors: [],
        };

        try {
            await this.triggerAmadeusSync();
            const cards = await this.acApi.fetchAllCards();
            result.totalCards = cards.length;

            if (!cards.length) {
                this.logger.warn('No cards fetched from Amadeus service');
                return result;
            }

            const { userByIdNumber, duplicateIdNumbers } = await this.buildUserLookup();
            const processedCardUids = await this.processCards(cards, userByIdNumber, duplicateIdNumbers, currentUserId, result);
            await this.deactivateOrphanBadges(processedCardUids, currentUserId, result);

            this.logger.log(
                `Badge import completed. Created: ${result.badgesCreated}, Updated: ${result.badgesUpdated}, ` +
                `Deactivated: ${result.badgesDeactivated}, NoIdNumber: ${result.skippedNoIdNumber}, ` +
                `NoMatch: ${result.skippedNoMatchingUser}, DuplicateId: ${result.skippedDuplicateIdNumber}`,
            );
        } catch (err) {
            const msg = (err as Error).message ?? 'Unknown error';
            this.logger.error(`Badge import failed: ${msg}`, (err as Error).stack);
            result.errors.push(msg);
        }

        return result;
    }

    private async triggerAmadeusSync(): Promise<void> {
        this.logger.log('Triggering cardholder + card sync on Amadeus service...');
        await this.acApi.triggerCardholderSync();
        await this.acApi.triggerCardSync();
    }

    private async buildUserLookup(): Promise<{
        userByIdNumber: Map<string, User>;
        duplicateIdNumbers: Set<string>;
    }> {
        const usersWithIdNumber = await this.userRepo
            .createQueryBuilder('user')
            .where('user.idNumber IS NOT NULL')
            .andWhere("user.idNumber != ''")
            .getMany();

        const idNumberCounts = new Map<string, User[]>();
        for (const user of usersWithIdNumber) {
            const key = user.idNumber!.trim().toLowerCase();
            const group = idNumberCounts.get(key) ?? [];
            group.push(user);
            idNumberCounts.set(key, group);
        }

        const userByIdNumber = new Map<string, User>();
        const duplicateIdNumbers = new Set<string>();

        for (const [key, users] of idNumberCounts) {
            if (users.length > 1) {
                duplicateIdNumbers.add(key);
                this.logger.warn(
                    `Duplicate idNumber "${users[0].idNumber}" for users: ${users.map(u => u.username).join(', ')}`,
                );
            } else {
                userByIdNumber.set(key, users[0]);
            }
        }

        return { userByIdNumber, duplicateIdNumbers };
    }

    private async processCards(
        cards: RemoteCardDto[],
        userByIdNumber: Map<string, User>,
        duplicateIdNumbers: Set<string>,
        currentUserId: string | undefined,
        result: BadgeImportResult,
    ): Promise<Set<string>> {
        const processedCardUids = new Set<string>();

        for (const card of cards) {
            try {
                if (!card.cardholderIdNumber) {
                    result.skippedNoIdNumber++;
                    continue;
                }

                const idKey = card.cardholderIdNumber.trim().toLowerCase();

                if (duplicateIdNumbers.has(idKey)) {
                    result.skippedDuplicateIdNumber++;
                    continue;
                }

                const user = userByIdNumber.get(idKey);
                if (!user) {
                    result.skippedNoMatchingUser++;
                    continue;
                }

                result.matchedUsers++;
                processedCardUids.add(card.amadeusUid);
                await this.upsertBadge(user, card, currentUserId, result);
            } catch (err) {
                const msg = (err as Error).message ?? 'Unknown error';
                this.logger.error(`Failed to process card ${card.amadeusUid}: ${msg}`);
                result.errors.push(`Card ${card.amadeusUid}: ${msg}`);
            }
        }

        return processedCardUids;
    }

    private async deactivateOrphanBadges(
        processedCardUids: Set<string>,
        currentUserId: string | undefined,
        result: BadgeImportResult,
    ): Promise<void> {
        const activeBadges = await this.badgeRepo.find({ where: { isActive: true } });
        const toDeactivate = activeBadges.filter(b => !processedCardUids.has(b.amadeusCardUid));

        for (const badge of toDeactivate) {
            badge.isActive = false;
            badge.updatedBy = currentUserId ?? null;
            await this.badgeRepo.save(badge);
            result.badgesDeactivated++;
        }
    }

    private async upsertBadge(
        user: User,
        card: RemoteCardDto,
        currentUserId: string | undefined,
        result: BadgeImportResult,
    ): Promise<void> {
        const isCardActive = this.isCardActive(card);

        // Update badge code on User table
        if (isCardActive && card.cardNumber && user.badge !== card.cardNumber) {
            user.badge = card.cardNumber;
            user.updatedBy = currentUserId ?? null;
            await this.userRepo.save(user);
        }

        const existing = await this.badgeRepo.findOne({
            where: { amadeusCardUid: card.amadeusUid },
        });

        if (existing) {
            const changed = this.updateBadgeFields(existing, user, card, isCardActive, currentUserId);
            if (changed) {
                existing.lastSyncedAt = new Date();
                existing.updatedBy = currentUserId ?? null;
                await this.badgeRepo.save(existing);
                result.badgesUpdated++;
            }
        } else {
            const badge = this.badgeRepo.create({
                userId: user.id,
                amadeusCardUid: card.amadeusUid,
                cardNumber: card.cardNumber,
                cardholderIdNumber: card.cardholderIdNumber,
                amadeusCardholderUid: card.cardholderUid,
                status: card.status,
                isActive: isCardActive,
                validFrom: card.fromDateValidUtc ? new Date(card.fromDateValidUtc) : null,
                validTo: card.toDateValidUtc ? new Date(card.toDateValidUtc) : null,
                lastSyncedAt: new Date(),
                createdBy: currentUserId ?? null,
                updatedBy: currentUserId ?? null,
            });
            await this.badgeRepo.save(badge);
            result.badgesCreated++;
        }
    }

    private updateBadgeFields(
        existing: UserBadge,
        user: User,
        card: RemoteCardDto,
        isCardActive: boolean,
        currentUserId: string | undefined,
    ): boolean {
        let changed = false;

        if (existing.userId !== user.id) { existing.userId = user.id; changed = true; }
        if (existing.cardNumber !== card.cardNumber) { existing.cardNumber = card.cardNumber; changed = true; }
        if (existing.cardholderIdNumber !== card.cardholderIdNumber) { existing.cardholderIdNumber = card.cardholderIdNumber; changed = true; }
        if (existing.amadeusCardholderUid !== card.cardholderUid) { existing.amadeusCardholderUid = card.cardholderUid; changed = true; }
        if (existing.status !== card.status) { existing.status = card.status; changed = true; }
        if (existing.isActive !== isCardActive) { existing.isActive = isCardActive; changed = true; }

        const validFrom = card.fromDateValidUtc ? new Date(card.fromDateValidUtc) : null;
        const validTo = card.toDateValidUtc ? new Date(card.toDateValidUtc) : null;

        if (existing.validFrom?.toISOString() !== validFrom?.toISOString()) { existing.validFrom = validFrom; changed = true; }
        if (existing.validTo?.toISOString() !== validTo?.toISOString()) { existing.validTo = validTo; changed = true; }

        return changed;
    }

    private isCardActive(card: RemoteCardDto): boolean {
        return !INACTIVE_STATUSES.has(card.status?.toLowerCase() ?? '');
    }
}
