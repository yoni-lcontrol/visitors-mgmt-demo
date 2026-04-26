import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { Visit } from './entities/visit.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { VisitEscort } from './entities/visit-escort.entity';
import { VisitVisitorStatus } from './entities/visit-visitor-status.entity';
import { Visitor } from './entities/visitor.entity';
import { CreateVisitDto, VisitRequesterDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { VisitorStatus } from './enums/visitor-status.enum';
import { VisitsQueryDto, TimeFilter } from './dto/visits-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { applyTableFilters, parseTableFilters } from '../common/utils/table-filter.util';
import { toExcelBuffer } from '../common/utils/excel.util';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { User } from '../users/entities/user.entity';
import { SmsNotificationService } from '../settings/sms-notification.service';
import { EmailNotificationService } from '../settings/email-notification.service';
import { NotificationEvent } from '../settings/enums/notification-event.enum';
import { AuditService } from '../audit/audit.service';
import { VisitParticipantService } from './visit-participant.service';
import { VisitCheckInCodeService } from './visit-check-in-code.service';
import { ParkingRequest } from './entities/parking-request.entity';
import { ParkingRequestStatus } from './enums/parking-request-status.enum';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { resolveVisitRequester, buildSmsData } from './visit.utils';
import { getDayBoundsUtc } from '../common/utils/date.util';
import { VisitorPersistenceService } from './visitor-persistence.service';
import {
    isEscortRequiredForVisit,
    isOnBehalfOnlyRole,
    resolveCreatorScopeRequirements,
    shouldRestrictDeletionToOwnVisits,
    VisitRoleName,
} from './visit-role-policy';

@Injectable()
export class VisitsService {
    constructor(
        @InjectRepository(Visit)
        private readonly visitRepo: Repository<Visit>,
        @InjectRepository(VisitVisitorStatus)
        private readonly statusRepo: Repository<VisitVisitorStatus>,
        @InjectRepository(Visitor)
        private readonly visitorRepo: Repository<Visitor>,
        @InjectRepository(VisitEscort)
        private readonly escortRepo: Repository<VisitEscort>,
        private readonly dataSource: DataSource,
        private readonly wsGateway: UsersGateway,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly smsNotification: SmsNotificationService,
        private readonly emailNotification: EmailNotificationService,
        private readonly auditService: AuditService,
        private readonly visitorPersistence: VisitorPersistenceService,
        private readonly participantService: VisitParticipantService,
        private readonly checkInCodeService: VisitCheckInCodeService,
    ) { }

    resolveVisitRequester(visit: Visit): { firstName: string; lastName: string; phone: string; email: string } | null {
        return resolveVisitRequester(visit);
    }

    private normalizeAutoEscortOrThrow(
        source: {
            firstName?: string | null;
            lastName?: string | null;
            phone?: string | null;
            email?: string | null;
            sector?: string | null;
        },
        sourceLabel: string,
    ): { firstName: string; lastName: string; phone: string; email: string; sector: string | null } {
        const firstName = source.firstName?.trim() ?? '';
        const lastName = source.lastName?.trim() ?? '';
        const phone = source.phone?.trim() ?? '';
        const email = source.email?.trim() ?? '';

        if (!firstName || !lastName || !phone || !email) {
            throw new BadRequestException(
                `Cannot auto-assign escort from ${sourceLabel}: firstName, lastName, phone and email are required`,
            );
        }

        return {
            firstName,
            lastName,
            phone,
            email,
            sector: source.sector?.trim() ? source.sector.trim() : null,
        };
    }

    private buildAutoEscortFromRequester(requester: VisitRequesterDto): {
        firstName: string;
        lastName: string;
        phone: string;
        email: string;
        sector: string | null;
    } {
        return this.normalizeAutoEscortOrThrow(
            {
                firstName: requester.firstName,
                lastName: requester.lastName,
                phone: requester.phone,
                email: requester.email,
            },
            'visit requester',
        );
    }

    private buildAutoEscortFromUser(user: User | null, sourceLabel: string): {
        firstName: string;
        lastName: string;
        phone: string;
        email: string;
        sector: string | null;
    } {
        if (!user) {
            throw new BadRequestException(`Cannot auto-assign escort from ${sourceLabel}: user not found`);
        }

        return this.normalizeAutoEscortOrThrow(
            {
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                email: user.email,
                sector: user.sector?.name ?? null,
            },
            sourceLabel,
        );
    }

    private getCreateEscorts(
        dto: CreateVisitDto,
        isSelfRequester: boolean,
        currentUser: User | null,
    ): Array<{ firstName: string; lastName: string; phone: string; email: string; sector?: string | null }> {
        const explicitEscorts = dto.escorts ?? [];
        if (explicitEscorts.length > 0) {
            return explicitEscorts;
        }

        if (!isSelfRequester && dto.visitRequester) {
            return [this.buildAutoEscortFromRequester(dto.visitRequester)];
        }

        return [this.buildAutoEscortFromUser(currentUser, 'current user')];
    }

    private async resolveAutoEscortForUpdate(
        visit: Visit,
        dto: UpdateVisitDto,
        currentUserId?: string,
    ): Promise<{ firstName: string; lastName: string; phone: string; email: string; sector: string | null }> {
        if (dto.visitRequester !== undefined) {
            if (dto.visitRequester === null) {
                if (!currentUserId) {
                    throw new BadRequestException('Cannot auto-assign escort from current user: user not found');
                }
                const currentUser = await this.userRepo.findOne({
                    where: { id: currentUserId },
                    relations: ['sector'],
                });
                return this.buildAutoEscortFromUser(currentUser, 'current user');
            }

            return this.buildAutoEscortFromRequester(dto.visitRequester as VisitRequesterDto);
        }

        if (visit.visitRequesterUserId) {
            const requesterUser = visit.visitRequesterUser ?? await this.userRepo.findOne({
                where: { id: visit.visitRequesterUserId },
                relations: ['sector'],
            });
            return this.buildAutoEscortFromUser(requesterUser, 'visit requester user');
        }

        return this.normalizeAutoEscortOrThrow(
            {
                firstName: visit.visitRequesterFirstName,
                lastName: visit.visitRequesterLastName,
                phone: visit.visitRequesterPhone,
                email: visit.visitRequesterEmail,
            },
            'visit requester',
        );
    }

    private async ensureAutoEscortForUpdate(
        visit: Visit,
        dto: UpdateVisitDto,
        currentUserId?: string,
    ): Promise<void> {
        const escortCount = await this.escortRepo.count({
            where: {
                visitId: visit.id,
                isActive: true,
            },
        });

        if (escortCount > 0) {
            return;
        }

        const autoEscort = await this.resolveAutoEscortForUpdate(visit, dto, currentUserId);
        const escort = this.escortRepo.create({
            visitId: visit.id,
            ...autoEscort,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });
        await this.escortRepo.save(escort);
    }

    private async resolveScopedCreatorUserIds(currentUserId?: string, userRoles?: string[]): Promise<string[] | null> {
        const creatorIds = new Set<string>();
        const scopeRequirements = resolveCreatorScopeRequirements(userRoles);

        if (scopeRequirements?.includeCurrentUser && currentUserId) {
            creatorIds.add(currentUserId);
        }

        if (scopeRequirements?.includeTrainingCenterUsers) {
            const trainingCenterUsers = await this.userRepo
                .createQueryBuilder('user')
                .leftJoin('user.role', 'primaryRole')
                .leftJoin('user.roles', 'secondaryRole')
                .where('primaryRole.name = :roleName', { roleName: VisitRoleName.TrainingCenter })
                .orWhere('secondaryRole.name = :roleName', { roleName: VisitRoleName.TrainingCenter })
                .select('user.id', 'id')
                .getRawMany<{ id: string }>();

            for (const user of trainingCenterUsers) {
                if (user.id) {
                    creatorIds.add(user.id);
                }
            }
        }

        if (scopeRequirements === null) {
            return null;
        }

        return [...creatorIds];
    }

    private applyCreatorScopeToVisitsQuery(
        qb: SelectQueryBuilder<any>,
        creatorUserIds: string[] | null,
    ): void {
        if (creatorUserIds === null) {
            return;
        }

        if (creatorUserIds.length === 0) {
            qb.andWhere('1 = 0');
            return;
        }

        qb.andWhere('v.createdByUserId IN (:...creatorUserIds)', { creatorUserIds });
    }

    // â”€â”€ Today Summary â”€â”€

    async getTodaySummary(currentUserId?: string, userRoles?: string[]): Promise<{
        totalVisitsToday: number;
        arrivedToday: number;
        checkedInToday: number;
        completedToday: number;
    }> {
        const { dayStart, dayEnd } = getDayBoundsUtc();
        const creatorUserIds = await this.resolveScopedCreatorUserIds(currentUserId, userRoles);

        // Count today's visits
        const totalVisitsToday = this.visitRepo
            .createQueryBuilder('v')
            .where('v.isActive = :active', { active: true })
            .andWhere('v.plannedStartTimeUtc < :dayEnd', { dayEnd })
            .andWhere(
                '(v.plannedStartTimeUtc >= :dayStart OR (v.plannedEndTimeUtc IS NOT NULL AND v.plannedEndTimeUtc >= :dayStartBound))',
                { dayStart, dayStartBound: dayStart },
            );

        this.applyCreatorScopeToVisitsQuery(totalVisitsToday, creatorUserIds);

        const totalVisitsTodayCount = await totalVisitsToday
            .getCount();

        // Count visitor statuses for today's visits
        const rows = this.statusRepo
            .createQueryBuilder('s')
            .select('s.currentStatus', 'currentStatus')
            .addSelect('COUNT(*)', 'cnt')
            .innerJoin('s.visitVisitor', 'vv')
            .innerJoin('vv.visit', 'v')
            .where('vv.isActive = :active', { active: true })
            .andWhere('v.isActive = :vActive', { vActive: true })
            .andWhere('v.plannedStartTimeUtc < :dayEnd', { dayEnd })
            .andWhere(
                '(v.plannedStartTimeUtc >= :dayStart OR (v.plannedEndTimeUtc IS NOT NULL AND v.plannedEndTimeUtc >= :dayStartBound))',
                { dayStart, dayStartBound: dayStart },
            );

        this.applyCreatorScopeToVisitsQuery(rows, creatorUserIds);

        const statusRows = await rows
            .groupBy('s.currentStatus')
            .getRawMany();

        let arrivedToday = 0;
        let checkedInToday = 0;
        let completedToday = 0;
        for (const row of statusRows) {
            const status = +row.currentStatus;
            const count = +row.cnt;
            if (status === VisitorStatus.Arrived) arrivedToday = count;
            if (status === VisitorStatus.CheckedIn) checkedInToday = count;
            if (status === VisitorStatus.CheckedOut) completedToday = count;
        }

        return { totalVisitsToday: totalVisitsTodayCount, arrivedToday, checkedInToday, completedToday };
    }

    // â”€â”€ Visits CRUD â”€â”€

    async findVisitsByDateRange(
        rangeStart: string,
        rangeEnd: string,
        search?: string,
        currentUserId?: string,
        userRoles?: string[],
    ): Promise<any[]> {
        const creatorUserIds = await this.resolveScopedCreatorUserIds(currentUserId, userRoles);
        const qb = this.visitRepo
            .createQueryBuilder('v')
            .leftJoinAndSelect('v.sector', 'sector')
            .leftJoinAndSelect('v.visitRequesterUser', 'reqUser')
            .where('v.isActive = :active', { active: true })
            .andWhere('v.plannedStartTimeUtc < :rangeEnd', { rangeEnd })
            .andWhere(
                '(v.plannedEndTimeUtc IS NOT NULL AND v.plannedEndTimeUtc > :rangeStart) OR (v.plannedEndTimeUtc IS NULL AND v.plannedStartTimeUtc >= :rangeStart)',
                { rangeStart },
            );

        this.applyCreatorScopeToVisitsQuery(qb, creatorUserIds);

        if (search) {
            qb.andWhere(
                '(v.title LIKE :s OR v.purposeOfVisit LIKE :s OR v.visitRequesterFirstName LIKE :s OR v.visitRequesterLastName LIKE :s OR reqUser.firstName LIKE :s OR reqUser.lastName LIKE :s)',
                { s: `%${search}%` },
            );
        }

        qb.orderBy('v.plannedStartTimeUtc', 'ASC');

        const items = await qb.getMany();
        const visitIds = items.map((i) => i.id);
        const summaries = visitIds.length ? await this.getStatusSummaries(visitIds) : {};

        return items.map((visit) => ({
            ...visit,
            sector: visit.sector ? { id: visit.sector.id, name: visit.sector.name } : null,
            visitRequester: this.resolveVisitRequester(visit),
            statusSummary: summaries[visit.id] ?? { total: 0, pending: 0, arrived: 0, checkedIn: 0, checkedOut: 0 },
        }));
    }

    async findAllVisits(query: VisitsQueryDto, currentUserId?: string, userRoles?: string[]): Promise<PaginatedResult<any>> {
        const { page, limit } = query;
        const qb = await this.buildVisitsQuery(query, currentUserId, userRoles);

        const total = await qb.getCount();
        const items = await qb.skip((page - 1) * limit).take(limit).getMany();

        const visitIds = items.map((i) => i.id);
        const summaries = visitIds.length ? await this.getStatusSummaries(visitIds) : {};

        const result = items.map((visit) => ({
            ...visit,
            buildingName: visit.building?.name ?? null,
            sector: visit.sector ? { id: visit.sector.id, name: visit.sector.name } : null,
            floor: visit.floor ?? null,
            visitRequester: this.resolveVisitRequester(visit),
            statusSummary: summaries[visit.id] ?? { total: 0, pending: 0, arrived: 0, checkedIn: 0, checkedOut: 0 },
        }));

        return { items: result, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async exportVisitsToExcel(query: VisitsQueryDto, currentUserId?: string, userRoles?: string[]): Promise<Buffer> {
        const qb = await this.buildVisitsQuery(query, currentUserId, userRoles);
        qb.leftJoinAndSelect('v.visitVisitors', 'vv')
            .leftJoinAndSelect('vv.visitor', 'visitor')
            .leftJoinAndSelect('vv.status', 'vvStatus')
            .leftJoinAndSelect('v.visitEscorts', 'escort');

        const visits = await qb.getMany();

        const statusLabel = (s: number): string => {
            switch (s) {
                case VisitorStatus.Pending: return 'Pending';
                case VisitorStatus.Arrived: return 'Arrived';
                case VisitorStatus.CheckedIn: return 'Checked In';
                case VisitorStatus.CheckedOut: return 'Checked Out';
                default: return 'Unknown';
            }
        };

        const rows: Array<Record<string, unknown>> = [];
        for (const visit of visits) {
            const requester = this.resolveVisitRequester(visit);
            const baseRow = {
                'Visit Title': visit.title,
                'Sector': visit.sector?.name ?? '',
                'Building': visit.building?.name ?? '',
                'Floor': visit.floor ?? '',
                'Purpose': visit.purposeOfVisit ?? '',
                'Planned Start': visit.plannedStartTimeUtc,
                'Planned End': visit.plannedEndTimeUtc ?? '',
                'Requester Name': requester ? `${requester.firstName} ${requester.lastName}`.trim() : '',
                'Requester Phone': requester?.phone ?? '',
                'Requester Email': requester?.email ?? '',
            };

            const visitors = visit.visitVisitors ?? [];
            const escorts = visit.visitEscorts ?? [];

            if (visitors.length === 0 && escorts.length === 0) {
                rows.push({ ...baseRow, 'Type': '', 'First Name': '', 'Last Name': '', 'Phone': '', 'Email': '', 'Person ID': '', 'Car Number': '', 'Status': '' });
            }

            for (const vv of visitors) {
                const v = vv.visitor;
                rows.push({
                    ...baseRow,
                    'Type': 'Visitor',
                    'First Name': v?.firstName ?? '',
                    'Last Name': v?.lastName ?? '',
                    'Phone': v?.phone ?? '',
                    'Email': v?.email ?? '',
                    'Person ID': v?.personId ?? '',
                    'Car Number': v?.carNumber ?? '',
                    'Status': vv.status ? statusLabel(vv.status.currentStatus) : 'Pending',
                });
            }

            for (const e of escorts) {
                rows.push({
                    ...baseRow,
                    'Type': 'Escort',
                    'First Name': e.firstName,
                    'Last Name': e.lastName,
                    'Phone': e.phone,
                    'Email': e.email,
                    'Person ID': '',
                    'Car Number': '',
                    'Status': '',
                });
            }
        }

        return toExcelBuffer(rows, 'Visits');
    }

    private async buildVisitsQuery(query: VisitsQueryDto, currentUserId?: string, userRoles?: string[]) {
        const { search, sortBy, sortOrder, filters, timeFilter } = query;
        const creatorUserIds = await this.resolveScopedCreatorUserIds(currentUserId, userRoles);
        const qb = this.visitRepo
            .createQueryBuilder('v')
            .leftJoinAndSelect('v.sector', 'sector')
            .leftJoinAndSelect('v.building', 'building')
            .leftJoinAndSelect('v.visitRequesterUser', 'reqUser')
            .where('v.isActive = :active', { active: true });

        this.applyCreatorScopeToVisitsQuery(qb, creatorUserIds);

        if (timeFilter) {
            this.applyTimeFilter(qb, timeFilter);
        }

        if (search) {
            qb.andWhere(
                '(v.title LIKE :s OR v.purposeOfVisit LIKE :s OR building.name LIKE :s)',
                { s: `%${search}%` },
            );
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            title: 'v.title',
            purposeOfVisit: 'v.purposeOfVisit',
            siteId: 'v.siteId',
            sectorName: 'sector.name',
            buildingName: 'building.name',
            floor: 'v.floor',
            plannedStartTimeUtc: 'v.plannedStartTimeUtc',
            plannedEndTimeUtc: 'v.plannedEndTimeUtc',
            createdAt: 'v.createdAt',
        });

        const sortable: Record<string, string> = {
            title: 'v.title',
            sectorName: 'sector.name',
            buildingName: 'building.name',
            floor: 'v.floor',
            plannedStartTimeUtc: 'v.plannedStartTimeUtc',
            plannedEndTimeUtc: 'v.plannedEndTimeUtc',
            createdAt: 'v.createdAt',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'v.plannedStartTimeUtc', sortOrder ?? 'DESC');

        return qb;
    }

    private applyTimeFilter(qb: ReturnType<Repository<Visit>['createQueryBuilder']>, timeFilter: TimeFilter): void {
        const now = new Date();
        switch (timeFilter) {
            case 'today': {
                const { dayStart, dayEnd } = getDayBoundsUtc();
                qb.andWhere('v.plannedStartTimeUtc < :dayEnd', { dayEnd });
                qb.andWhere(
                    '(v.plannedStartTimeUtc >= :dayStart OR (v.plannedEndTimeUtc IS NOT NULL AND v.plannedEndTimeUtc >= :dayStartBound))',
                    { dayStart, dayStartBound: dayStart },
                );
                break;
            }
            case 'future': {
                // Start time > now
                qb.andWhere('v.plannedStartTimeUtc > :now', { now: now.toISOString() });
                break;
            }
            case 'history': {
                // End time < now (only visits that have an end time that has passed)
                qb.andWhere('v.plannedEndTimeUtc IS NOT NULL');
                qb.andWhere('v.plannedEndTimeUtc < :now', { now: now.toISOString() });
                break;
            }
        }
    }

    private async getStatusSummaries(visitIds: string[]): Promise<Record<string, any>> {
        const rows = await this.statusRepo
            .createQueryBuilder('s')
            .select('s.visitId', 'visitId')
            .addSelect('COUNT(*)', 'total')
            .addSelect(`SUM(CASE WHEN s.currentStatus = ${VisitorStatus.Pending} THEN 1 ELSE 0 END)`, 'pending')
            .addSelect(`SUM(CASE WHEN s.currentStatus = ${VisitorStatus.Arrived} THEN 1 ELSE 0 END)`, 'arrived')
            .addSelect(`SUM(CASE WHEN s.currentStatus = ${VisitorStatus.CheckedIn} THEN 1 ELSE 0 END)`, 'checkedIn')
            .addSelect(`SUM(CASE WHEN s.currentStatus = ${VisitorStatus.CheckedOut} THEN 1 ELSE 0 END)`, 'checkedOut')
            .where('s.visitId IN (:...visitIds)', { visitIds })
            .groupBy('s.visitId')
            .getRawMany();

        const map: Record<string, any> = {};
        for (const row of rows) {
            map[row.visitId] = {
                total: +row.total,
                pending: +row.pending,
                arrived: +row.arrived,
                checkedIn: +row.checkedIn,
                checkedOut: +row.checkedOut,
            };
        }
        return map;
    }

    async findVisitById(id: string, currentUserId?: string, userRoles?: string[]): Promise<any> {
        const creatorUserIds = await this.resolveScopedCreatorUserIds(currentUserId, userRoles);
        const visit = await this.visitRepo.findOne({
            where: { id, isActive: true },
            relations: ['sector', 'building', 'visitRequesterUser'],
        });
        if (!visit) throw new NotFoundException('Visit not found');

        if (creatorUserIds !== null && !creatorUserIds.includes(visit.createdByUserId ?? '')) {
            throw new NotFoundException('Visit not found');
        }

        const summary = await this.getStatusSummaries([id]);
        return {
            ...visit,
            sector: visit.sector ? { id: visit.sector.id, name: visit.sector.name } : null,
            building: visit.building ? { id: visit.building.id, name: visit.building.name } : null,
            visitRequester: this.resolveVisitRequester(visit),
            statusSummary: summary[id] ?? { total: 0, pending: 0, arrived: 0, checkedIn: 0, checkedOut: 0 },
        };
    }

    async createVisit(
        dto: CreateVisitDto,
        currentUserId?: string,
        userPermissions?: string[],
        userRoles?: string[],
    ): Promise<any> {
        if (!dto.visitors || dto.visitors.length === 0) {
            throw new BadRequestException('A visit must have at least one visitor');
        }

        // Resolve visitRequester: if provided, store manual fields; otherwise store userId reference
        const isSelfRequester = !dto.visitRequester;
        if (isSelfRequester && !currentUserId) {
            throw new BadRequestException('visitRequester is required');
        }

        if (isOnBehalfOnlyRole(userRoles) && isSelfRequester) {
            throw new BadRequestException('This role must create visits on behalf of another requester');
        }

        if (isEscortRequiredForVisit(userRoles, isSelfRequester) && (!dto.escorts || dto.escorts.length === 0)) {
            throw new BadRequestException('At least one escort is required for the current user');
        }

        const currentUser = currentUserId
            ? await this.userRepo.findOne({ where: { id: currentUserId }, relations: ['sector'] })
            : null;
        const escortsToCreate = this.getCreateEscorts(dto, isSelfRequester, currentUser);

        // Check blacklist for all visitors
        await this.participantService.validateVisitorsNotBlacklisted(dto.visitors);

        const plannedStart = new Date(dto.plannedStartTimeUtc);
        const plannedEnd = new Date(dto.plannedEndTimeUtc);
        if (plannedEnd <= plannedStart) {
            throw new BadRequestException('End datetime must be after start datetime');
        }

        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();

        try {
            const visit = qr.manager.create(Visit, {
                title: dto.title,
                purposeOfVisit: dto.purposeOfVisit ?? null,
                siteId: dto.siteId ?? null,
                sectorId: currentUser?.sectorId ?? null,
                buildingId: dto.buildingId ?? null,
                floor: dto.floor ?? null,
                plannedStartTimeUtc: plannedStart,
                plannedEndTimeUtc: plannedEnd,
                visitRequesterUserId: isSelfRequester ? currentUserId! : null,
                visitRequesterFirstName: dto.visitRequester?.firstName ?? null,
                visitRequesterLastName: dto.visitRequester?.lastName ?? null,
                visitRequesterPhone: dto.visitRequester?.phone ?? null,
                visitRequesterEmail: dto.visitRequester?.email ?? null,
                createdByUserId: currentUserId ?? null,
                createdBy: currentUserId ?? null,
                updatedBy: currentUserId ?? null,
            });
            const savedVisit = await qr.manager.save(visit);

            for (const v of dto.visitors) {
                const { visitor: savedVisitor } = await this.visitorPersistence.upsertByPersonId({
                    firstName: v.firstName,
                    lastName: v.lastName,
                    email: v.email ?? null,
                    phone: v.phone ?? null,
                    personId: v.personId,
                    carNumber: v.hasVehicle ? (v.carNumber ?? null) : null,
                    vehicleType: v.hasVehicle ? (v.vehicleType ?? null) : null,
                }, currentUserId, qr.manager);

                const vv = qr.manager.create(VisitVisitor, {
                    visitId: savedVisit.id,
                    visitorId: savedVisitor.id,
                    notes: v.notes ?? null,
                    createdBy: currentUserId ?? null,
                    updatedBy: currentUserId ?? null,
                });
                const savedVv = await qr.manager.save(vv);

                const status = qr.manager.create(VisitVisitorStatus, {
                    visitVisitorId: savedVv.id,
                    visitId: savedVisit.id,
                    visitorId: savedVisitor.id,
                    currentStatus: VisitorStatus.Pending,
                });
                await qr.manager.save(status);

                // Create parking request if requested and user has permission
                if (v.requestParking && v.hasVehicle && userPermissions?.includes(PermissionKey.ParkingRequest)) {
                    const autoApprove = userPermissions.includes(PermissionKey.ParkingAutoApprove);
                    const parkingReq = qr.manager.create(ParkingRequest, {
                        visitVisitorId: savedVv.id,
                        status: autoApprove ? ParkingRequestStatus.Approved : ParkingRequestStatus.Pending,
                        reviewedByUserId: autoApprove ? (currentUserId ?? null) : null,
                        reviewedAt: autoApprove ? new Date() : null,
                        createdBy: currentUserId ?? null,
                    });
                    await qr.manager.save(parkingReq);
                }
            }

            for (const e of escortsToCreate) {
                const escort = qr.manager.create(VisitEscort, {
                    visitId: savedVisit.id,
                    firstName: e.firstName,
                    lastName: e.lastName,
                    phone: e.phone,
                    email: e.email,
                    sector: e.sector?.trim() ? e.sector.trim() : null,
                    createdBy: currentUserId ?? null,
                    updatedBy: currentUserId ?? null,
                });
                await qr.manager.save(escort);
            }

            await qr.commitTransaction();
            this.wsGateway.broadcastToAll('visits:created', { id: savedVisit.id, title: savedVisit.title });

            this.auditService.log({
                userId: currentUserId,
                module: 'visitors',
                action: 'CREATE',
                entity: 'Visit',
                entityId: savedVisit.id,
                description: `Created visit "${savedVisit.title}" with ${dto.visitors.length} visitors`,
                newValue: { title: dto.title, siteId: dto.siteId, sectorId: currentUser?.sectorId ?? null, visitorCount: dto.visitors.length, escortCount: escortsToCreate.length },
            }).catch(() => { });

            // Trigger SMS for visit created (fire-and-forget)
            const firstVisitor = dto.visitors[0];
            const smsVisitorData = firstVisitor ? {
                firstName: firstVisitor.firstName,
                lastName: firstVisitor.lastName,
                personId: firstVisitor.personId,
                phone: firstVisitor.phone ?? '',
                carNumber: firstVisitor.carNumber ?? '',
            } : undefined;

            // Resolve requester name for notifications
            let requesterName = '';
            if (dto.visitRequester) {
                requesterName = [dto.visitRequester.firstName, dto.visitRequester.lastName].filter(Boolean).join(' ');
            } else if (currentUser) {
                requesterName = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ');
            }

            this.smsNotification.triggerSms(NotificationEvent.VisitCreated, {
                visit: {
                    title: savedVisit.title,
                    startTime: savedVisit.plannedStartTimeUtc?.toLocaleString('he-IL') ?? '',
                    endTime: savedVisit.plannedEndTimeUtc?.toLocaleString('he-IL') ?? '',
                    hostName: requesterName,
                    siteName: dto.siteId ?? '',
                    purposeOfVisit: dto.purposeOfVisit ?? '',
                },
                visitor: smsVisitorData,
            }).catch(() => { /* SMS failure must not affect the visit flow */ });

            // Trigger email for visit created (fire-and-forget)
            this.emailNotification.triggerEmail(NotificationEvent.VisitCreated, {
                visit: {
                    title: savedVisit.title,
                    startTime: savedVisit.plannedStartTimeUtc?.toLocaleString('he-IL') ?? '',
                    endTime: savedVisit.plannedEndTimeUtc?.toLocaleString('he-IL') ?? '',
                    hostName: requesterName,
                    siteName: dto.siteId ?? '',
                    purposeOfVisit: dto.purposeOfVisit ?? '',
                },
                visitor: smsVisitorData,
            }).catch(() => { /* Email failure must not affect the visit flow */ });

            // Generate and send check-in codes (fire-and-forget)
            this.checkInCodeService.generateCodesForVisit(savedVisit.id, currentUserId)
                .then(() => this.checkInCodeService.sendCodeNotifications(savedVisit.id, currentUserId))
                .catch(() => { });

            return this.findVisitById(savedVisit.id, currentUserId, userRoles);
        } catch (err) {
            await qr.rollbackTransaction();
            throw err;
        } finally {
            await qr.release();
        }
    }

    async updateVisit(id: string, dto: UpdateVisitDto, currentUserId?: string): Promise<any> {
        const visit = await this.visitRepo.findOne({ where: { id, isActive: true } });
        if (!visit) throw new NotFoundException('Visit not found');

        // Determine visitRequester storage strategy
        const isSwitchToSelf = dto.visitRequester === null;
        const isSwitchToManual = dto.visitRequester !== undefined && dto.visitRequester !== null;

        const oldValue = { title: visit.title, siteId: visit.siteId, buildingId: visit.buildingId, floor: visit.floor, purposeOfVisit: visit.purposeOfVisit };

        const newStart = dto.plannedStartTimeUtc
            ? new Date(dto.plannedStartTimeUtc)
            : visit.plannedStartTimeUtc;
        const newEnd = dto.plannedEndTimeUtc
            ? new Date(dto.plannedEndTimeUtc)
            : visit.plannedEndTimeUtc;
        if (newEnd && newEnd <= newStart) {
            throw new BadRequestException('End datetime must be after start datetime');
        }

        Object.assign(visit, {
            title: dto.title ?? visit.title,
            purposeOfVisit: dto.purposeOfVisit !== undefined ? dto.purposeOfVisit : visit.purposeOfVisit,
            siteId: dto.siteId !== undefined ? dto.siteId : visit.siteId,
            buildingId: dto.buildingId !== undefined ? dto.buildingId : visit.buildingId,
            floor: dto.floor !== undefined ? (dto.floor ?? null) : visit.floor,
            plannedStartTimeUtc: newStart,
            plannedEndTimeUtc: newEnd,
            ...(isSwitchToSelf ? {
                visitRequesterUserId: currentUserId ?? visit.visitRequesterUserId,
                visitRequesterFirstName: null,
                visitRequesterLastName: null,
                visitRequesterPhone: null,
                visitRequesterEmail: null,
            } : isSwitchToManual ? {
                visitRequesterUserId: null,
                visitRequesterFirstName: dto.visitRequester!.firstName,
                visitRequesterLastName: dto.visitRequester!.lastName,
                visitRequesterPhone: dto.visitRequester!.phone,
                visitRequesterEmail: dto.visitRequester!.email,
            } : {}),
            updatedBy: currentUserId ?? null,
        });
        await this.visitRepo.save(visit);
        await this.ensureAutoEscortForUpdate(visit, dto, currentUserId);

        // Reload with visitRequesterUser for SMS/email hostName resolution
        if (visit.visitRequesterUserId && !visit.visitRequesterUser) {
            const user = await this.userRepo.findOne({ where: { id: visit.visitRequesterUserId } });
            if (user) visit.visitRequesterUser = user as any;
        }

        // Trigger SMS for visit updated (fire-and-forget)
        this.smsNotification.triggerSms(NotificationEvent.VisitUpdated, buildSmsData(visit))
            .catch(() => { /* SMS failure must not affect the visit flow */ });

        // Trigger email for visit updated (fire-and-forget)
        this.emailNotification.triggerEmail(NotificationEvent.VisitUpdated, buildSmsData(visit))
            .catch(() => { /* Email failure must not affect the visit flow */ });

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'UPDATE',
            entity: 'Visit',
            entityId: id,
            description: `Updated visit "${visit.title}"`,
            oldValue,
            newValue: { title: dto.title, siteId: dto.siteId, buildingId: dto.buildingId, purposeOfVisit: dto.purposeOfVisit },
        }).catch(() => { });

        return this.findVisitById(id, currentUserId);
    }

    async removeVisit(id: string, currentUserId?: string, userRoles?: string[]): Promise<void> {
        const visit = await this.visitRepo.findOne({ where: { id, isActive: true } });
        if (!visit) throw new NotFoundException('Visit not found');

        if (shouldRestrictDeletionToOwnVisits(userRoles) && visit.createdByUserId !== currentUserId) {
            throw new NotFoundException('Visit not found');
        }

        // Trigger SMS for visit deleted before soft-delete (fire-and-forget)
        this.smsNotification.triggerSms(NotificationEvent.VisitDeleted, buildSmsData(visit))
            .catch(() => { /* SMS failure must not affect the visit flow */ });

        // Trigger email for visit deleted (fire-and-forget)
        this.emailNotification.triggerEmail(NotificationEvent.VisitDeleted, buildSmsData(visit))
            .catch(() => { /* Email failure must not affect the visit flow */ });

        visit.isActive = false;
        visit.updatedBy = currentUserId ?? null;
        await this.visitRepo.save(visit);

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'DELETE',
            entity: 'Visit',
            entityId: id,
            description: `Deleted visit "${visit.title}"`,
        }).catch(() => { });
    }
}
