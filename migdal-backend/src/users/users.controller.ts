import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
    Res,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { sendExcelResponse } from '../common/utils/excel.util';
import { UsersService } from './users.service';
import { AdSyncService } from './ad-sync.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly adSyncService: AdSyncService,
    ) { }

    @Get()
    @RequirePermissions(PermissionKey.UsersRead)
    @ApiOperation({ summary: 'List all users (paginated)' })
    findAll(@Query() query: PaginationQueryDto) {
        return this.usersService.findAll(query);
    }

    @Get('lookup')
    @RequirePermissions(PermissionKey.VisitsCreate)
    @ApiOperation({ summary: 'Search users for requester selection (visit on-behalf flow)' })
    lookup(@Query() query: PaginationQueryDto) {
        return this.usersService.findAll(query);
    }

    @Get('export')
    @RequirePermissions(PermissionKey.UsersRead)
    @ApiOperation({ summary: 'Export users as Excel' })
    async export(
        @Query() query: PaginationQueryDto,
        @Res() res: Response,
    ) {
        const file = await this.usersService.exportToExcel(query);
        sendExcelResponse(res, file, 'users.xlsx');
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.UsersRead)
    @ApiOperation({ summary: 'Get user by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.UsersCreate)
    @ApiOperation({ summary: 'Create a new user' })
    create(
        @Body() dto: CreateUserDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.usersService.create(dto, currentUserId);
    }

    @Post('sync-ad')
    @RequirePermissions(PermissionKey.UsersSync)
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({ summary: 'Trigger full AD user synchronization (async, progress via WebSocket)' })
    syncFromAd(@CurrentUser('sub') currentUserId: string) {
        // Fire-and-forget: run sync in background, progress reported via WS events
        this.adSyncService.syncAll(currentUserId).catch((err) => {
            new Logger('UsersController').error('Background AD sync failed', (err as Error).stack);
        });
        return { message: 'AD sync started, progress will be reported via WebSocket' };
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.UsersUpdate)
    @ApiOperation({ summary: 'Update user' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateUserDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.usersService.update(id, dto, currentUserId);
    }

    @Post(':id/role')
    @RequirePermissions(PermissionKey.UsersUpdate)
    @ApiOperation({ summary: 'Assign role to user' })
    assignRole(
        @Param('id', ParseUUIDPipe) id: string,
        @Body('roleId') roleId: string | null,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.usersService.assignRole(id, roleId, currentUserId);
    }

    @Post(':id/roles')
    @RequirePermissions(PermissionKey.UsersUpdate)
    @ApiOperation({ summary: 'Assign multiple roles to user' })
    assignRoles(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignUserRolesDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.usersService.assignRoles(id, dto.roleIds, currentUserId);
    }
}
