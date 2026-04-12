import { Controller, Get, Put, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EmailTemplateService } from './email-template.service';
import { BulkUpsertEmailTemplatesDto } from './dto/bulk-upsert-email-templates.dto';
import { PreviewEmailTemplateDto } from './dto/preview-email-template.dto';
import { TestEmailDto } from './dto/test-email.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { EmailTemplateRendererService } from './email-template-renderer.service';

@ApiTags('Email Templates')
@ApiBearerAuth()
@Controller('settings/email-templates')
export class EmailTemplateController {
    constructor(
        private readonly service: EmailTemplateService,
        private readonly renderer: EmailTemplateRendererService,
    ) { }

    @Get()
    @RequirePermissions(PermissionKey.SettingsRead)
    @ApiOperation({ summary: 'Get all email templates' })
    findAll() {
        return this.service.findAll();
    }

    @Put()
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Bulk upsert email templates' })
    bulkUpsert(
        @Body() dto: BulkUpsertEmailTemplatesDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.service.bulkUpsert(dto.templates, currentUserId);
    }

    @Post('preview')
    @RequirePermissions(PermissionKey.SettingsRead)
    @ApiOperation({ summary: 'Preview an email template with sample data' })
    preview(@Body() dto: PreviewEmailTemplateDto) {
        return this.service.preview(dto.event, dto.subject, dto.bodyHtml, dto.targetGroup);
    }

    @Get('placeholders')
    @RequirePermissions(PermissionKey.SettingsRead)
    @ApiOperation({ summary: 'Get supported email placeholders' })
    getPlaceholders() {
        return { placeholders: this.renderer.getSupportedPlaceholders() };
    }

    @Post('test')
    @RequirePermissions(PermissionKey.SettingsUpdate)
    @ApiOperation({ summary: 'Send a test email with sample data' })
    testEmail(@Body() dto: TestEmailDto) {
        return this.service.testEmail(dto.email, dto.subject, dto.bodyHtml);
    }
}
