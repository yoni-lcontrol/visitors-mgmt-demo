import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Put,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { sendExcelResponse } from '../common/utils/excel.util';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
    constructor(private readonly rolesService: RolesService) { }

    @Get()
    @RequirePermissions(PermissionKey.RolesRead)
    @ApiOperation({ summary: 'List all roles (paginated)' })
    findAll(@Query() query: PaginationQueryDto) {
        return this.rolesService.findAll(query);
    }

    @Get('export')
    @RequirePermissions(PermissionKey.RolesRead)
    @ApiOperation({ summary: 'Export roles as Excel' })
    async export(
        @Query() query: PaginationQueryDto,
        @Res() res: Response,
    ) {
        const file = await this.rolesService.exportToExcel(query);
        sendExcelResponse(res, file, 'roles.xlsx');
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.RolesRead)
    @ApiOperation({ summary: 'Get role by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.rolesService.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.RolesCreate)
    @ApiOperation({ summary: 'Create a new role' })
    create(
        @Body() dto: CreateRoleDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.rolesService.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.RolesUpdate)
    @ApiOperation({ summary: 'Update role' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateRoleDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.rolesService.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.RolesDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft-delete role' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.rolesService.remove(id, currentUserId);
    }

    @Put(':id/permissions')
    @RequirePermissions(PermissionKey.RolesUpdate)
    @ApiOperation({ summary: 'Assign permissions to role' })
    assignPermissions(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignPermissionsDto,
    ) {
        return this.rolesService.assignPermissions(id, dto.permissionIds);
    }
}
