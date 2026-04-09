import { Controller, Get, Post, Patch, Delete, Param, Body, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { WorkstationsService } from './services/workstations.service';
import { WorkstationSessionService } from './services/workstation-session.service';
import {
    CreateWorkstationDto,
    UpdateWorkstationDto,
    AssignWorkstationUsersDto,
    AssignWorkstationRolesDto,
    CreateEnrollmentTokenDto,
    BindWorkstationDto,
} from './dto';

@ApiTags('Workstations')
@Controller('workstations')
export class WorkstationsController {
    constructor(
        private readonly workstationsService: WorkstationsService,
        private readonly workstationSessionService: WorkstationSessionService,
    ) { }

    @Post('bind')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Bind current user session to a workstation' })
    bind(@Body() dto: BindWorkstationDto, @CurrentUser() user: JwtPayload) {
        return this.workstationSessionService.bindUserToWorkstationWithDeviceStatus(
            user.sub,
            'rest-session',
            dto.workstationId,
            user.roleIds || [],
        );
    }

    @Get('session/current')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get the current active workstation session with device status' })
    async getCurrentSession(@CurrentUser() user: JwtPayload) {
        return this.workstationSessionService.getActiveSessionWithDeviceStatus(user.sub);
    }

    @Get()
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.WorkstationsRead)
    @ApiOperation({ summary: 'List all workstations with device status' })
    findAll() {
        return this.workstationsService.findAllWithDeviceStatus();
    }

    @Get('available-roles')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.WorkstationsUpdate)
    @ApiOperation({ summary: 'List all active roles for workstation assignment' })
    getAvailableRoles() {
        return this.workstationsService.getAvailableRoles();
    }

    @Get('accessible')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List workstations accessible to the current user' })
    findAccessible(@CurrentUser() user: JwtPayload) {
        return this.workstationsService.getAccessibleWorkstationsWithDeviceStatus(user.sub, user.roleIds || []);
    }

    @Get(':id')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.WorkstationsRead)
    @ApiOperation({ summary: 'Get workstation details with assignments and agents' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.workstationsService.findByIdWithDetails(id);
    }

    @Post()
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.WorkstationsCreate)
    @ApiOperation({ summary: 'Create a new workstation' })
    create(@Body() dto: CreateWorkstationDto, @CurrentUser() user: JwtPayload) {
        return this.workstationsService.create(dto, user.sub);
    }

    @Patch(':id')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.WorkstationsUpdate)
    @ApiOperation({ summary: 'Update a workstation' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateWorkstationDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.workstationsService.update(id, dto, user.sub);
    }

    @Delete(':id')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.WorkstationsDelete)
    @ApiOperation({ summary: 'Deactivate a workstation' })
    remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.workstationsService.remove(id, user.sub);
    }

    @Post(':id/assign-users')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.WorkstationsAssignUsers)
    @ApiOperation({ summary: 'Assign users to a workstation' })
    assignUsers(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignWorkstationUsersDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.workstationsService.assignUsers(id, dto.userIds, user.sub);
    }

    @Post(':id/assign-roles')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.WorkstationsAssignRoles)
    @ApiOperation({ summary: 'Assign roles to a workstation' })
    assignRoles(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignWorkstationRolesDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.workstationsService.assignRoles(id, dto.roleIds, user.sub);
    }

    @Post(':id/enrollment-token')
    @ApiBearerAuth()
    @RequirePermissions(PermissionKey.WorkstationsEnrollAgents)
    @ApiOperation({ summary: 'Generate an agent enrollment token for a workstation' })
    createEnrollmentToken(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CreateEnrollmentTokenDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.workstationsService.createEnrollmentToken(id, dto.providerType, user.sub);
    }
}
