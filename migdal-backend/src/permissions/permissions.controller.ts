import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
    constructor(private readonly permissionsService: PermissionsService) { }

    @Get()
    @RequirePermissions(PermissionKey.PermissionsRead)
    @ApiOperation({ summary: 'List all permissions' })
    findAll() {
        return this.permissionsService.findAll();
    }

    @Get('grouped')
    @RequirePermissions(PermissionKey.PermissionsRead)
    @ApiOperation({ summary: 'List permissions grouped by module' })
    findGrouped() {
        return this.permissionsService.findGroupedByModule();
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.PermissionsRead)
    @ApiOperation({ summary: 'Get permission by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.permissionsService.findById(id);
    }
}
