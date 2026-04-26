import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AccessLevelService } from '../services/access-level.service';
import { CreateAccessLevelDto } from '../dto/create-access-level.dto';
import { UpdateAccessLevelDto } from '../dto/update-access-level.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionKey } from '../../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { AccessLevelQueryDto } from '../dto/access-level-query.dto';
import { ImportService } from '../services/import.service';

@ApiTags('Access Control - Access Levels')
@ApiBearerAuth()
@Controller('access-control/access-levels')
export class AccessLevelController {
    constructor(
        private readonly accessLevelService: AccessLevelService,
        private readonly importService: ImportService,
    ) { }

    @Get()
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'List all access levels (paginated)' })
    findAll(@Query() query: AccessLevelQueryDto) {
        return this.accessLevelService.findAll(query);
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'Get access level by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.accessLevelService.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.AccessControlCreate)
    @ApiOperation({ summary: 'Create an access level' })
    create(
        @Body() dto: CreateAccessLevelDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.accessLevelService.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.AccessControlUpdate)
    @ApiOperation({ summary: 'Update an access level' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateAccessLevelDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.accessLevelService.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.AccessControlDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete an access level' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.accessLevelService.remove(id, currentUserId);
    }

    @Post('import')
    @RequirePermissions(PermissionKey.AccessControlImport)
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({ summary: 'Trigger access levels import from remote server' })
    async importData() {
        const result = await this.importService.triggerAccessLevelImport();
        return {
            message: `Import completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            items: result.items,
            errors: result.errors,
        };
    }
}
