import { Controller, Get, Put, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SmsTemplateService } from './sms-template.service';
import { BulkUpsertSmsTemplatesDto } from './dto/bulk-upsert-sms-templates.dto';
import { PreviewSmsTemplateDto } from './dto/preview-sms-template.dto';
import { TestSmsDto } from './dto/test-sms.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { SmsTemplateRendererService } from './sms-template-renderer.service';

@ApiTags('SMS Templates')
@ApiBearerAuth()
@Controller('settings/sms-templates')
export class SmsTemplateController {
    constructor(
        private readonly service: SmsTemplateService,
        private readonly renderer: SmsTemplateRendererService,
    ) { }

    @Get()
    @RequirePermissions(PermissionKey.SettingsRead)
    @ApiOperation({ summary: 'Get all SMS templates' })
    findAll() {
        return this.service.findAll();
    }

    @Put()
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Bulk upsert SMS templates' })
    bulkUpsert(
        @Body() dto: BulkUpsertSmsTemplatesDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.service.bulkUpsert(dto.templates, currentUserId);
    }

    @Post('preview')
    @RequirePermissions(PermissionKey.SettingsRead)
    @ApiOperation({ summary: 'Preview an SMS template with sample data' })
    preview(@Body() dto: PreviewSmsTemplateDto) {
        return this.service.preview(dto.event, dto.template, dto.targetGroup);
    }

    @Get('placeholders')
    @RequirePermissions(PermissionKey.SettingsRead)
    @ApiOperation({ summary: 'Get supported SMS placeholders' })
    getPlaceholders() {
        return { placeholders: this.renderer.getSupportedPlaceholders() };
    }

    @Post('test')
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Send a test SMS with sample data' })
    testSms(@Body() dto: TestSmsDto) {
        return this.service.testSms(dto.phone, dto.template);
    }
}
