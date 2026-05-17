import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessControlApiService } from '../../access-control/services/ac-api.service';
import { ParkingRequest } from '../../visitors/entities/parking-request.entity';
import { ParkingRequestStatus } from '../../visitors/enums/parking-request-status.enum';

@Injectable()
export class AmadeusParkingSyncService {
    private readonly logger = new Logger(AmadeusParkingSyncService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly acApi: AccessControlApiService,
        @InjectRepository(ParkingRequest)
        private readonly parkingRepo: Repository<ParkingRequest>,
    ) {}

    /**
     * Syncs an approved parking visitor to Amadeus 8.
     * Called after automatic or manual parking approval.
     * Safe to call multiple times (idempotent).
     * Non-blocking: errors are logged but do not throw.
     */
    async syncApprovedParkingVisitorToAmadeus(parkingRequestId: string): Promise<void> {
        const enabled = this.configService.get<string>('AMADEUS_ENABLED', 'false');
        if (enabled !== 'true') {
            this.logger.debug(`Amadeus sync disabled. Skipping. parkingRequestId: ${parkingRequestId}`);
            return;
        }

        this.logger.log(`Attempting to sync approved parking visitor to Amadeus. parkingRequestId: ${parkingRequestId}`);

        try {
            // 1. Load parking request with full relations
            const request = await this.parkingRepo.findOne({
                where: { id: parkingRequestId, isActive: true },
                relations: ['visitVisitor', 'visitVisitor.visitor', 'visitVisitor.visit'],
            });

            if (!request) {
                this.logger.warn(`Parking request not found. Skipping Amadeus sync. parkingRequestId: ${parkingRequestId}`);
                return;
            }

            // 2. Validate parking is approved
            if (request.status !== ParkingRequestStatus.Approved) {
                this.logger.debug(`Parking request is not approved (status: ${request.status}). Skipping Amadeus sync. parkingRequestId: ${parkingRequestId}`);
                return;
            }

            const visitor = request.visitVisitor?.visitor;
            const visit = request.visitVisitor?.visit;

            if (!visitor || !visit) {
                this.logger.warn(`Visitor or visit not found for parking request. Skipping Amadeus sync. parkingRequestId: ${parkingRequestId}`);
                return;
            }

            // 3. Validate license plate exists
            const rawPlate = visitor.carNumber;
            if (!rawPlate || !rawPlate.trim()) {
                this.logger.warn(`License plate is missing. Skipping Amadeus sync. parkingRequestId: ${parkingRequestId}, visitorId: ${visitor.id}`);
                return;
            }

            // 4. Validate dates
            if (!visit.plannedStartTimeUtc) {
                this.logger.warn(`Visit has no start date. Skipping Amadeus sync. parkingRequestId: ${parkingRequestId}`);
                return;
            }

            // 5. Normalize license plate (keep as-is; Amadeus carRegistrationNum accepts any format)
            const licensePlate = rawPlate.trim();
            this.logger.log(`Normalized license plate. original: "${rawPlate}", normalized: "${licensePlate}", visitorId: ${visitor.id}`);

            // 6. Get parking access group from config
            const parkingAccessGroup = this.configService.get<string>('AMADEUS_PARKING_ACCESS_GROUP');

            // 7. Build cardholder ID (use visitor personId to prevent duplicates)
            const cardholderIdNumber = `VIS-${visitor.personId}`;

            // 8. Create or update cardholder in Amadeus via AC API service
            this.logger.log(`Creating/updating Amadeus cardholder for visitor. parkingRequestId: ${parkingRequestId}, cardholderIdNumber: ${cardholderIdNumber}`);

            const result = await this.acApi.createCardholder({
                personId: cardholderIdNumber,
                firstName: visitor.firstName,
                lastName: visitor.lastName,
                fromDate: visit.plannedStartTimeUtc.toISOString(),
                toDate: visit.plannedEndTimeUtc?.toISOString(),
                accessLevelNames: parkingAccessGroup ? [parkingAccessGroup] : undefined,
                licensePlate,
                isVisitor: true,
            });

            this.logger.log(
                `Successfully synced parking visitor to Amadeus. parkingRequestId: ${parkingRequestId}, ` +
                `cardholderIdNumber: ${cardholderIdNumber}, amadeusCardholderId: ${result.cardholderId ?? 'unknown'}, licensePlate: ${licensePlate}`,
            );
        } catch (error: any) {
            this.logger.error(
                `Failed to sync approved parking visitor to Amadeus. parkingRequestId: ${parkingRequestId}, error: ${error.message}`,
                error.stack,
            );
        }
    }
}
