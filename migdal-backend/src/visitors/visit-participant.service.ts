import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Visit } from './entities/visit.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { VisitEscort } from './entities/visit-escort.entity';
import { VisitVisitorStatus } from './entities/visit-visitor-status.entity';
import { Visitor } from './entities/visitor.entity';
import { AddVisitVisitorsDto } from './dto/add-visit-visitors.dto';
import { AddVisitEscortsDto } from './dto/add-visit-escorts.dto';
import { UpdateVisitVisitorDto } from './dto/update-visit-visitor.dto';
import { UpdateVisitEscortDto } from './dto/update-visit-escort.dto';
import { VisitorStatus } from './enums/visitor-status.enum';
import { ParkingRequestStatus } from './enums/parking-request-status.enum';
import { ParkingRequest } from './entities/parking-request.entity';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { BlacklistService } from './blacklist.service';
import { VisitCheckInCodeService } from './visit-check-in-code.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class VisitParticipantService {
    constructor(
        @InjectRepository(Visit)
        private readonly visitRepo: Repository<Visit>,
        @InjectRepository(VisitVisitor)
        private readonly visitVisitorRepo: Repository<VisitVisitor>,
        @InjectRepository(VisitEscort)
        private readonly visitEscortRepo: Repository<VisitEscort>,
        @InjectRepository(VisitVisitorStatus)
        private readonly statusRepo: Repository<VisitVisitorStatus>,
        @InjectRepository(Visitor)
        private readonly visitorRepo: Repository<Visitor>,
        private readonly dataSource: DataSource,
        private readonly blacklistService: BlacklistService,
        private readonly checkInCodeService: VisitCheckInCodeService,
        @InjectRepository(ParkingRequest)
        private readonly parkingRequestRepo: Repository<ParkingRequest>,
        private readonly auditService: AuditService,
    ) { }

    // ── Validation helpers (public for use by VisitsService.createVisit) ──

    async validateVisitorsNotBlacklisted(visitors: { personId?: string; carNumber?: string }[]): Promise<void> {
        const personIds = visitors.map((v) => v.personId).filter(Boolean) as string[];
        const carNumbers = visitors.map((v) => v.carNumber).filter(Boolean) as string[];

        const [personMap, vehicleMap] = await Promise.all([
            personIds.length ? this.blacklistService.checkBlacklistStatusBatch(personIds) : new Map(),
            carNumbers.length ? this.blacklistService.checkVehicleBlacklistStatusBatch(carNumbers) : new Map(),
        ]);

        for (const v of visitors) {
            if (v.personId) {
                const result = personMap.get(v.personId);
                if (result?.isBlacklisted) {
                    throw new BadRequestException(`Visitor with ID ${v.personId} is currently blacklisted: ${result.reason}`);
                }
            }
            if (v.carNumber) {
                const result = vehicleMap.get(v.carNumber);
                if (result?.isBlacklisted) {
                    throw new BadRequestException(`Vehicle ${v.carNumber} is currently blacklisted: ${result.reason}`);
                }
            }
        }
    }

    // ── Visit Visitors ──

    async getVisitVisitors(visitId: string): Promise<any[]> {
        const visit = await this.visitRepo.findOne({ where: { id: visitId, isActive: true } });
        if (!visit) throw new NotFoundException('Visit not found');

        const visitors = await this.visitVisitorRepo.find({
            where: { visitId, isActive: true },
            relations: ['visitor', 'status'],
        });

        const vvIds = visitors.map((vv) => vv.id);
        const parkingRequests = vvIds.length
            ? await this.parkingRequestRepo.find({ where: vvIds.map(id => ({ visitVisitorId: id, isActive: true })) })
            : [];
        const parkingMap = new Map(parkingRequests.map(pr => [pr.visitVisitorId, pr]));

        return visitors.map((vv) => {
            const pr = parkingMap.get(vv.id);
            return {
                id: vv.id,
                visitId: vv.visitId,
                visitorId: vv.visitorId,
                notes: vv.notes,
                visitor: vv.visitor ? {
                    id: vv.visitor.id,
                    firstName: vv.visitor.firstName,
                    lastName: vv.visitor.lastName,
                    fullName: `${vv.visitor.firstName} ${vv.visitor.lastName}`,
                    email: vv.visitor.email,
                    phone: vv.visitor.phone,
                    personId: vv.visitor.personId,
                    carNumber: vv.visitor.carNumber,
                    vehicleType: vv.visitor.vehicleType,
                } : null,
                parkingRequest: pr ? { status: pr.status } : null,
                status: vv.status ? {
                    currentStatus: vv.status.currentStatus,
                    arrivedAtUtc: vv.status.arrivedAtUtc,
                    checkedInAtUtc: vv.status.checkedInAtUtc,
                    checkedOutAtUtc: vv.status.checkedOutAtUtc,
                    lastEventTimeUtc: vv.status.lastEventTimeUtc,
                } : null,
                createdAt: vv.createdAt,
            };
        });
    }

    async addVisitVisitors(visitId: string, dto: AddVisitVisitorsDto, currentUserId?: string, userPermissions?: string[]): Promise<any[]> {
        const visit = await this.visitRepo.findOne({ where: { id: visitId, isActive: true } });
        if (!visit) throw new NotFoundException('Visit not found');

        await this.validateVisitorsNotBlacklisted(dto.visitors);

        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            for (const v of dto.visitors) {
                const visitor = qr.manager.create(Visitor, {
                    firstName: v.firstName,
                    lastName: v.lastName,
                    email: v.email ?? null,
                    phone: v.phone ?? null,
                    personId: v.personId,
                    carNumber: v.hasVehicle ? (v.carNumber ?? null) : null,
                    vehicleType: v.hasVehicle ? (v.vehicleType ?? null) : null,
                    createdBy: currentUserId ?? null,
                    updatedBy: currentUserId ?? null,
                });
                const savedVisitor = await qr.manager.save(visitor);

                const vv = qr.manager.create(VisitVisitor, {
                    visitId,
                    visitorId: savedVisitor.id,
                    notes: v.notes ?? null,
                    createdBy: currentUserId ?? null,
                    updatedBy: currentUserId ?? null,
                });
                const savedVv = await qr.manager.save(vv);

                const status = qr.manager.create(VisitVisitorStatus, {
                    visitVisitorId: savedVv.id,
                    visitId,
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

            await qr.commitTransaction();

            this.auditService.log({
                userId: currentUserId,
                module: 'visitors',
                action: 'ADD_VISITORS',
                entity: 'Visit',
                entityId: visitId,
                description: `Added ${dto.visitors.length} visitors to visit`,
                newValue: { visitorCount: dto.visitors.length },
            }).catch(() => { });

            // Generate and send check-in codes for newly added visitors (fire-and-forget)
            this.checkInCodeService.generateCodesForVisit(visitId, currentUserId)
                .then(() => this.checkInCodeService.sendCodeNotifications(visitId, currentUserId))
                .catch(() => { });
        } catch (err) {
            await qr.rollbackTransaction();
            throw err;
        } finally {
            await qr.release();
        }

        return this.getVisitVisitors(visitId);
    }

    async updateVisitVisitor(visitId: string, visitVisitorId: string, dto: UpdateVisitVisitorDto, currentUserId?: string, userPermissions?: string[]): Promise<any[]> {
        const vv = await this.visitVisitorRepo.findOne({ where: { id: visitVisitorId, visitId, isActive: true } });
        if (!vv) throw new NotFoundException('Visit visitor not found');

        const visitor = await this.visitorRepo.findOne({ where: { id: vv.visitorId, isActive: true } });
        if (!visitor) throw new NotFoundException('Visitor not found');

        const oldVisitorValue = { firstName: visitor.firstName, lastName: visitor.lastName, personId: visitor.personId, email: visitor.email, phone: visitor.phone };

        if (dto.personId !== undefined) {
            const blacklistResult = await this.blacklistService.checkBlacklistStatus(dto.personId);
            if (blacklistResult.isBlacklisted) {
                throw new BadRequestException(`Visitor with ID ${dto.personId} is currently blacklisted: ${blacklistResult.reason}`);
            }
        }

        if (dto.firstName !== undefined) visitor.firstName = dto.firstName;
        if (dto.lastName !== undefined) visitor.lastName = dto.lastName;
        if (dto.email !== undefined) visitor.email = dto.email ?? null;
        if (dto.phone !== undefined) visitor.phone = dto.phone ?? null;
        if (dto.personId !== undefined) visitor.personId = dto.personId;
        if (dto.carNumber !== undefined) visitor.carNumber = dto.carNumber ?? null;
        if (dto.vehicleType !== undefined) visitor.vehicleType = dto.vehicleType ?? null;
        if (dto.hasVehicle === false) {
            visitor.carNumber = null;
            visitor.vehicleType = null;
        }
        visitor.updatedBy = currentUserId ?? null;
        await this.visitorRepo.save(visitor);

        if (dto.notes !== undefined) vv.notes = dto.notes ?? null;
        vv.updatedBy = currentUserId ?? null;
        await this.visitVisitorRepo.save(vv);

        // Handle parking request on update
        if (dto.requestParking !== undefined && userPermissions?.includes(PermissionKey.ParkingRequest)) {
            const hasVehicle = dto.hasVehicle ?? !!(visitor.carNumber);
            const existing = await this.parkingRequestRepo.findOne({ where: { visitVisitorId, isActive: true } });
            if (dto.requestParking && hasVehicle && !existing) {
                const autoApprove = userPermissions.includes(PermissionKey.ParkingAutoApprove);
                const parkingReq = this.parkingRequestRepo.create({
                    visitVisitorId,
                    status: autoApprove ? ParkingRequestStatus.Approved : ParkingRequestStatus.Pending,
                    reviewedByUserId: autoApprove ? (currentUserId ?? null) : null,
                    reviewedAt: autoApprove ? new Date() : null,
                    createdBy: currentUserId ?? null,
                });
                await this.parkingRequestRepo.save(parkingReq);
            } else if (!dto.requestParking && existing) {
                existing.isActive = false;
                existing.updatedBy = currentUserId ?? null;
                await this.parkingRequestRepo.save(existing);
            }
        }

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'UPDATE_VISITOR',
            entity: 'Visit',
            entityId: visitId,
            description: `Updated visitor "${visitor.firstName} ${visitor.lastName}" in visit`,
            oldValue: oldVisitorValue,
            newValue: dto,
            metadata: { visitVisitorId },
        }).catch(() => { });

        return this.getVisitVisitors(visitId);
    }

    async removeVisitVisitor(visitId: string, visitVisitorId: string, currentUserId?: string): Promise<void> {
        const vv = await this.visitVisitorRepo.findOne({ where: { id: visitVisitorId, visitId, isActive: true } });
        if (!vv) throw new NotFoundException('Visit visitor not found');

        // A visit must have at least one visitor — prevent removing the last one
        const activeCount = await this.visitVisitorRepo.count({ where: { visitId, isActive: true } });
        if (activeCount <= 1) {
            throw new BadRequestException('Cannot remove the last visitor from a visit');
        }

        vv.isActive = false;
        vv.updatedBy = currentUserId ?? null;
        await this.visitVisitorRepo.save(vv);

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'REMOVE_VISITOR',
            entity: 'Visit',
            entityId: visitId,
            description: `Removed visitor from visit`,
            metadata: { visitVisitorId },
        }).catch(() => { });
    }

    // ── Visit Escorts (free text) ──

    async getVisitEscorts(visitId: string): Promise<any[]> {
        const visit = await this.visitRepo.findOne({ where: { id: visitId, isActive: true } });
        if (!visit) throw new NotFoundException('Visit not found');

        return this.visitEscortRepo.find({
            where: { visitId, isActive: true },
            order: { createdAt: 'ASC' },
        });
    }

    async addVisitEscorts(visitId: string, dto: AddVisitEscortsDto, currentUserId?: string): Promise<any[]> {
        const visit = await this.visitRepo.findOne({ where: { id: visitId, isActive: true } });
        if (!visit) throw new NotFoundException('Visit not found');

        for (const e of dto.escorts) {
            const escort = this.visitEscortRepo.create({
                visitId,
                firstName: e.firstName,
                lastName: e.lastName,
                phone: e.phone,
                email: e.email,
                createdBy: currentUserId ?? null,
                updatedBy: currentUserId ?? null,
            });
            await this.visitEscortRepo.save(escort);
        }

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'ADD_ESCORTS',
            entity: 'Visit',
            entityId: visitId,
            description: `Added ${dto.escorts.length} escorts to visit`,
            newValue: { escortCount: dto.escorts.length },
        }).catch(() => { });

        return this.getVisitEscorts(visitId);
    }

    async updateVisitEscort(visitId: string, visitEscortId: string, dto: UpdateVisitEscortDto, currentUserId?: string): Promise<any[]> {
        const escort = await this.visitEscortRepo.findOne({ where: { id: visitEscortId, visitId, isActive: true } });
        if (!escort) throw new NotFoundException('Visit escort not found');

        const oldEscortValue = { firstName: escort.firstName, lastName: escort.lastName, phone: escort.phone, email: escort.email };

        if (dto.firstName !== undefined) escort.firstName = dto.firstName;
        if (dto.lastName !== undefined) escort.lastName = dto.lastName;
        if (dto.phone !== undefined) escort.phone = dto.phone;
        if (dto.email !== undefined) escort.email = dto.email;
        escort.updatedBy = currentUserId ?? null;
        await this.visitEscortRepo.save(escort);

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'UPDATE_ESCORT',
            entity: 'Visit',
            entityId: visitId,
            description: `Updated escort "${escort.firstName} ${escort.lastName}" in visit`,
            oldValue: oldEscortValue,
            newValue: dto,
            metadata: { visitEscortId },
        }).catch(() => { });

        return this.getVisitEscorts(visitId);
    }

    async removeVisitEscort(visitId: string, visitEscortId: string, currentUserId?: string): Promise<void> {
        const escort = await this.visitEscortRepo.findOne({ where: { id: visitEscortId, visitId, isActive: true } });
        if (!escort) throw new NotFoundException('Visit escort not found');
        escort.isActive = false;
        escort.updatedBy = currentUserId ?? null;
        await this.visitEscortRepo.save(escort);

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'REMOVE_ESCORT',
            entity: 'Visit',
            entityId: visitId,
            description: `Removed escort "${escort.firstName} ${escort.lastName}" from visit`,
            metadata: { visitEscortId },
        }).catch(() => { });
    }
}
