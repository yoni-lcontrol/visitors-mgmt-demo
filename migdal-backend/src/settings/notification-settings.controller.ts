import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationSettingsService } from './notification-settings.service';
import { BulkUpsertNotificationSettingsDto } from './dto/bulk-upsert-notification-settings.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';

@ApiTags('Notification Settings')
@ApiBearerAuth()
@Controller('settings/notifications')
export class NotificationSettingsController {
    constructor(private readonly service: NotificationSettingsService) { }

    @Get()
    @RequirePermissions(PermissionKey.SettingsRead)
    @ApiOperation({ summary: 'Get all notification settings' })
    findAll() {
        return this.service.findAll();
    }

    @Put()
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Bulk upsert notification settings' })
    bulkUpsert(
        @Body() dto: BulkUpsertNotificationSettingsDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.service.bulkUpsert(dto.settings, currentUserId);
    }
}
