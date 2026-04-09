import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { sendExcelResponse } from '../common/utils/excel.util';
import { AuditQueryDto } from './dto/audit-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get()
    @RequirePermissions(PermissionKey.AuditRead)
    @ApiOperation({ summary: 'List audit log entries (paginated, filtered, sorted)' })
    findAll(@Query() query: AuditQueryDto) {
        return this.auditService.findAll(query);
    }

    @Get('export')
    @RequirePermissions(PermissionKey.AuditRead)
    @ApiOperation({ summary: 'Export audit logs as Excel' })
    async export(
        @Query() query: AuditQueryDto,
        @Res() res: Response,
    ) {
        const file = await this.auditService.exportToExcel(query);
        sendExcelResponse(res, file, 'audit-logs.xlsx');
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.AuditRead)
    @ApiOperation({ summary: 'Get a single audit log entry by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.auditService.findOne(id);
    }
}
