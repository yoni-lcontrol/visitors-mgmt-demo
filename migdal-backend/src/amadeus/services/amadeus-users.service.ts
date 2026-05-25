import { Injectable, Logger } from '@nestjs/common';
import { AccessControlApiService } from '../../access-control/services/ac-api.service';
import { AddAmadeusUserDto } from '../dto/add-amadeus-user.dto';
import { AmadeusSyncQueueService } from './amadeus-sync-queue.service';
import { SyncQueueOperation, SyncQueueSource } from '../entities/amadeus-sync-queue.entity';

@Injectable()
export class AmadeusUsersService {
    private readonly logger = new Logger(AmadeusUsersService.name);

    constructor(
        private readonly acApi: AccessControlApiService,
        private readonly syncQueue: AmadeusSyncQueueService,
    ) { }

    async addUserToAmadeus(dto: AddAmadeusUserDto, options?: { source?: SyncQueueSource; referenceId?: string; referenceType?: string }) {
        this.logger.log(`Adding user to Amadeus: ${dto.cardholderIdNumber} (${dto.firstName} ${dto.lastName})`);

        const payload = {
            personId: dto.cardholderIdNumber,
            firstName: dto.firstName,
            lastName: dto.lastName,
            fromDate: dto.fromDateValid,
            toDate: dto.toDateValid,
            accessLevelNames: dto.accessGroupApiKeys,
            licensePlate: dto.licensePlate,
            isVisitor: true,
        };

        const result = await this.syncQueue.enqueueAndExecute({
            operation: SyncQueueOperation.CreateCardholder,
            source: options?.source ?? SyncQueueSource.CardholderCrud,
            payload,
            personId: dto.cardholderIdNumber,
            referenceId: options?.referenceId,
            referenceType: options?.referenceType,
        });

        if (result.executed) {
            this.logger.log(`User added to Amadeus successfully: ${dto.cardholderIdNumber}`);
            return { cardholderId: dto.cardholderIdNumber, success: true, queued: false };
        }

        this.logger.warn(`User queued for Amadeus sync: ${dto.cardholderIdNumber}. Error: ${result.error}`);
        return { cardholderId: null, success: false, queued: true, queueId: result.queueId };
    }

    async deleteUserFromAmadeus(amadeusUid: string, options?: { source?: SyncQueueSource; referenceId?: string; referenceType?: string }) {
        this.logger.log(`Deleting user from Amadeus: ${amadeusUid}`);

        const result = await this.syncQueue.enqueueAndExecute({
            operation: SyncQueueOperation.DeleteCardholder,
            source: options?.source ?? SyncQueueSource.CardholderCrud,
            payload: { amadeusUid },
            cardholderId: amadeusUid,
            referenceId: options?.referenceId,
            referenceType: options?.referenceType,
        });

        if (result.executed) {
            this.logger.log(`User deleted from Amadeus successfully: ${amadeusUid}`);
            return { success: true, queued: false };
        }

        this.logger.warn(`Delete queued for Amadeus sync: ${amadeusUid}. Error: ${result.error}`);
        return { success: false, queued: true, queueId: result.queueId };
    }
}
