import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { RetentionCleanupService } from './retention-cleanup.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
    constructor(
        private readonly settingsService: SettingsService,
        private readonly retentionCleanupService: RetentionCleanupService,
    ) { }

    @Get()
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.SettingsRead)
    @ApiOperation({ summary: 'List all settings (optionally filtered by group)' })
    findAll(@Query('group') group?: string) {
        return this.settingsService.findAll(group);
    }

    @Public()
    @Get('public')
    @ApiOperation({ summary: 'List public settings (no auth required)' })
    findPublic() {
        return this.settingsService.findPublic();
    }

    @Get(':key')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.SettingsRead)
    @ApiOperation({ summary: 'Get setting by key' })
    findByKey(@Param('key') key: string) {
        return this.settingsService.findByKey(key);
    }

    @Post()
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Create a new setting' })
    create(
        @Body() dto: CreateSettingDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.settingsService.create(dto, currentUserId);
    }

    @Patch(':key')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Update setting value' })
    update(
        @Param('key') key: string,
        @Body() dto: UpdateSettingDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.settingsService.update(key, dto, currentUserId);
    }

    @Delete(':key')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft-delete setting' })
    remove(
        @Param('key') key: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.settingsService.remove(key, currentUserId);
    }

    @Post('device-command-logs/cleanup')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Manually trigger device command log retention cleanup' })
    triggerDeviceCommandLogCleanup() {
        return this.retentionCleanupService.handleRetentionCleanup();
    }
}
