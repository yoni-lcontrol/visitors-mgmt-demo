import { Injectable, Logger } from '@nestjs/common';
import { AccessControlApiService } from '../../access-control/services/ac-api.service';
import { AddAmadeusUserDto } from '../dto/add-amadeus-user.dto';

@Injectable()
export class AmadeusUsersService {
    private readonly logger = new Logger(AmadeusUsersService.name);

    constructor(private readonly acApi: AccessControlApiService) { }

    async addUserToAmadeus(dto: AddAmadeusUserDto) {
        this.logger.log(`Adding user to Amadeus: ${dto.cardholderIdNumber} (${dto.firstName} ${dto.lastName})`);

        try {
            const result = await this.acApi.createCardholder({
                personId: dto.cardholderIdNumber,
                firstName: dto.firstName,
                lastName: dto.lastName,
                fromDate: dto.fromDateValid,
                toDate: dto.toDateValid,
                accessLevelNames: dto.accessGroupApiKeys,
            });

            this.logger.log(`User added to Amadeus successfully: ${result.cardholderId}`);
            return result;
        } catch (error: any) {
            this.logger.error(`Failed to add user to Amadeus: ${error.message}`, error.stack);
            throw error;
        }
    }

    async deleteUserFromAmadeus(amadeusUid: string) {
        this.logger.log(`Deleting user from Amadeus: ${amadeusUid}`);

        try {
            const result = await this.acApi.deleteCardholder(amadeusUid);
            this.logger.log(`User deleted from Amadeus successfully: ${amadeusUid}`);
            return result;
        } catch (error: any) {
            this.logger.error(`Failed to delete user from Amadeus: ${error.message}`, error.stack);
            throw error;
        }
    }
}
