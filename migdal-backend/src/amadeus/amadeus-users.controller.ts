import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { AmadeusUsersService } from './services/amadeus-users.service';
import { AddAmadeusUserDto } from './dto/add-amadeus-user.dto';
import { DeleteAmadeusUserDto } from './dto/delete-amadeus-user.dto';

@ApiTags('Amadeus Users')
@ApiBearerAuth()
@Controller('amadeus/users')
export class AmadeusUsersController {
    private readonly logger = new Logger(AmadeusUsersController.name);

    constructor(private readonly amadeusUsersService: AmadeusUsersService) { }

    @Post('add')
    @RequirePermissions(PermissionKey.AccessControlCreate)
    @ApiOperation({ summary: 'Add a user to Amadeus access control system' })
    async addUser(@Body() dto: AddAmadeusUserDto) {
        this.logger.log(`Request to add user: ${dto.cardholderIdNumber}`);
        return this.amadeusUsersService.addUserToAmadeus(dto);
    }

    @Post('delete')
    @RequirePermissions(PermissionKey.AccessControlDelete)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete a user from Amadeus access control system' })
    async deleteUser(@Body() dto: DeleteAmadeusUserDto) {
        this.logger.log(`Request to delete user: ${dto.amadeusUid}`);
        return this.amadeusUsersService.deleteUserFromAmadeus(dto.amadeusUid);
    }
}
