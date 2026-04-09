import { Injectable, Logger } from '@nestjs/common';
import { AccessControlApiService } from './ac-api.service';
import { AuditService } from '../../audit/audit.service';
import {
    RemoteCardholder,
    RemoteCardholderResponse,
    RemoteCardholderListResponse,
    CardholderQueryParams,
} from '../interfaces/ac-api.interface';
import { CreateCardholderDto } from '../dto/create-cardholder.dto';
import { UpdateCardholderDto } from '../dto/update-cardholder.dto';
import { CardholderQueryDto } from '../dto/cardholder-query.dto';

@Injectable()
export class CardholderService {
    private readonly logger = new Logger(CardholderService.name);

    constructor(
        private readonly acApi: AccessControlApiService,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: CardholderQueryDto): Promise<RemoteCardholderListResponse> {
        const params: CardholderQueryParams = {
            search: query.search,
            accessLevelName: query.accessLevelName,
            isVisitor: query.isVisitor,
            active: query.active,
            page: query.page,
            limit: query.limit,
        };

        return this.acApi.downloadCardholders(params);
    }

    async findOne(cardholderId: string): Promise<RemoteCardholder> {
        return this.acApi.getCardholder(cardholderId);
    }

    async create(dto: CreateCardholderDto, currentUserId?: string): Promise<RemoteCardholderResponse> {
        const cardholder: RemoteCardholder = {
            firstName: dto.firstName,
            lastName: dto.lastName,
            personId: dto.personId,
            cardNumber: dto.cardNumber,
            accessLevelNames: dto.accessLevelNames,
            pin: dto.pin,
            fromDate: dto.fromDate,
            toDate: dto.toDate,
            isVisitor: dto.isVisitor,
            active: true,
        };

        const result = await this.acApi.createCardholder(cardholder);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'CARDHOLDER_CREATE',
            entity: 'Cardholder',
            entityId: result.cardholderId,
            description: `Created cardholder "${dto.firstName} ${dto.lastName}" (${dto.personId})`,
            newValue: { firstName: dto.firstName, lastName: dto.lastName, personId: dto.personId },
        }).catch(() => { });

        return result;
    }

    async update(
        cardholderId: string,
        dto: UpdateCardholderDto,
        currentUserId?: string,
    ): Promise<RemoteCardholderResponse> {
        const cardholder: Partial<RemoteCardholder> = {};
        if (dto.firstName !== undefined) cardholder.firstName = dto.firstName;
        if (dto.lastName !== undefined) cardholder.lastName = dto.lastName;
        if (dto.personId !== undefined) cardholder.personId = dto.personId;
        if (dto.cardNumber !== undefined) cardholder.cardNumber = dto.cardNumber;
        if (dto.accessLevelNames !== undefined) cardholder.accessLevelNames = dto.accessLevelNames;
        if (dto.pin !== undefined) cardholder.pin = dto.pin;
        if (dto.fromDate !== undefined) cardholder.fromDate = dto.fromDate;
        if (dto.toDate !== undefined) cardholder.toDate = dto.toDate;
        if (dto.isVisitor !== undefined) cardholder.isVisitor = dto.isVisitor;

        const result = await this.acApi.updateCardholder(cardholderId, cardholder);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'CARDHOLDER_UPDATE',
            entity: 'Cardholder',
            entityId: cardholderId,
            description: `Updated cardholder ${cardholderId}`,
            newValue: cardholder,
        }).catch(() => { });

        return result;
    }

    async remove(cardholderId: string, currentUserId?: string): Promise<RemoteCardholderResponse> {
        const result = await this.acApi.deleteCardholder(cardholderId);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'CARDHOLDER_DELETE',
            entity: 'Cardholder',
            entityId: cardholderId,
            description: `Deleted cardholder ${cardholderId}`,
        }).catch(() => { });

        return result;
    }

    async createBatch(
        cardholders: CreateCardholderDto[],
        currentUserId?: string,
    ): Promise<{ succeeded: number; failed: number; errors: Array<{ index: number; error: string }> }> {
        const remoteCardholders: RemoteCardholder[] = cardholders.map((dto) => ({
            firstName: dto.firstName,
            lastName: dto.lastName,
            personId: dto.personId,
            cardNumber: dto.cardNumber,
            accessLevelNames: dto.accessLevelNames,
            pin: dto.pin,
            fromDate: dto.fromDate,
            toDate: dto.toDate,
            isVisitor: dto.isVisitor,
            active: true,
        }));

        const result = await this.acApi.createCardholderBatch(remoteCardholders);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'CARDHOLDER_BATCH_CREATE',
            entity: 'Cardholder',
            description: `Batch created cardholders: ${result.succeeded} succeeded, ${result.failed} failed`,
            metadata: { succeeded: result.succeeded, failed: result.failed },
        }).catch(() => { });

        return result;
    }

    async removeBatch(
        cardholderIds: string[],
        currentUserId?: string,
    ): Promise<{ succeeded: number; failed: number; errors: Array<{ id: string; error: string }> }> {
        const result = await this.acApi.deleteCardholderBatch(cardholderIds);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'CARDHOLDER_BATCH_DELETE',
            entity: 'Cardholder',
            description: `Batch deleted cardholders: ${result.succeeded} succeeded, ${result.failed} failed`,
            metadata: { succeeded: result.succeeded, failed: result.failed },
        }).catch(() => { });

        return result;
    }
}
