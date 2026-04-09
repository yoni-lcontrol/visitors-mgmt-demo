import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ExtensionService } from '../services/extension.service';
import { sendExcelResponse } from '../../common/utils/excel.util';
import { CreateExtensionDto } from '../dto/create-extension.dto';
import { UpdateExtensionDto } from '../dto/update-extension.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionKey } from '../../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Access Control - Extensions')
@ApiBearerAuth()
@Controller('access-control/extensions')
export class ExtensionController {
    constructor(private readonly extensionService: ExtensionService) { }

    @Get()
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'List all extensions (paginated)' })
    findAll(@Query() query: PaginationQueryDto) {
        return this.extensionService.findAll(query);
    }

    @Get('export')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'Export extensions as Excel' })
    async export(
        @Query() query: PaginationQueryDto,
        @Res() res: Response,
    ) {
        const file = await this.extensionService.exportToExcel(query);
        sendExcelResponse(res, file, 'extensions.xlsx');
    }

    @Get('by-controller/:controllerId')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'List extensions by controller' })
    findByController(@Param('controllerId', ParseUUIDPipe) controllerId: string) {
        return this.extensionService.findByController(controllerId);
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'Get extension by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.extensionService.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.AccessControlCreate)
    @ApiOperation({ summary: 'Create an extension' })
    create(
        @Body() dto: CreateExtensionDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.extensionService.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.AccessControlUpdate)
    @ApiOperation({ summary: 'Update an extension' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateExtensionDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.extensionService.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.AccessControlDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete an extension' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.extensionService.remove(id, currentUserId);
    }
}
