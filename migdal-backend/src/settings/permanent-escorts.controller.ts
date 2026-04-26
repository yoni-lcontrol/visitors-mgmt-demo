import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { AddPermanentEscortDto } from './dto/add-permanent-escort.dto';
import { PermanentEscortsService } from './permanent-escorts.service';

@ApiTags('Permanent Escorts')
@ApiBearerAuth()
@Controller('settings/permanent-escorts')
export class PermanentEscortsController {
    constructor(private readonly permanentEscortsService: PermanentEscortsService) { }

    @Get()
    @RequirePermissions(PermissionKey.SettingsPermanentEscortsRead)
    @ApiOperation({ summary: 'List permanent escorts' })
    getAll() {
        return this.permanentEscortsService.getAll();
    }

    @Get('domains')
    @RequirePermissions(PermissionKey.SettingsPermanentEscortsRead)
    @ApiOperation({ summary: 'List active domains for permanent escorts flow' })
    getDomains() {
        return this.permanentEscortsService.getDomains();
    }

    @Get('domain-users/:domainId')
    @RequirePermissions(PermissionKey.SettingsPermanentEscortsRead)
    @ApiOperation({ summary: 'List active users by domain' })
    getUsersByDomain(@Param('domainId', ParseUUIDPipe) domainId: string) {
        return this.permanentEscortsService.getUsersByDomain(domainId);
    }

    @Post()
    @RequirePermissions(PermissionKey.SettingsPermanentEscortsManage)
    @ApiOperation({ summary: 'Add a user as permanent escort' })
    add(
        @Body() dto: AddPermanentEscortDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.permanentEscortsService.add(dto, currentUserId);
    }

    @Delete(':userId')
    @RequirePermissions(PermissionKey.SettingsPermanentEscortsManage)
    @ApiOperation({ summary: 'Remove a user from permanent escorts' })
    remove(
        @Param('userId', ParseUUIDPipe) userId: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.permanentEscortsService.remove(userId, currentUserId);
    }
}
