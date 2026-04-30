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
    Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { sendExcelResponse } from '../common/utils/excel.util';
import { VisitorsService } from './visitors.service';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Visitors')
@ApiBearerAuth()
@Controller('visitors')
export class VisitorsController {
    constructor(private readonly visitorsService: VisitorsService) { }

    @Get()
    @RequirePermissions(PermissionKey.VisitorsRead)
    @ApiOperation({ summary: 'List visitors (paginated)' })
    findAll(
        @Query() query: PaginationQueryDto,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('permissions') permissions: string[],
    ) {
        return this.visitorsService.findAll(query, currentUserId, permissions);
    }

    @Get('search')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Search visitors by personId prefix' })
    searchByPersonId(
        @Query('personId') personId: string,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('permissions') permissions: string[],
    ) {
        return this.visitorsService.searchByPersonId(personId, currentUserId, permissions);
    }

    @Get('export')
    @RequirePermissions(PermissionKey.VisitorsExport)
    @ApiOperation({ summary: 'Export visitors as Excel' })
    async export(
        @Query() query: PaginationQueryDto,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('permissions') permissions: string[],
        @Res() res: Response,
    ) {
        const file = await this.visitorsService.exportToExcel(query, currentUserId, permissions);
        sendExcelResponse(res, file, 'visitors.xlsx');
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.VisitorsRead)
    @ApiOperation({ summary: 'Get visitor by ID' })
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('permissions') permissions: string[],
    ) {
        return this.visitorsService.findById(id, currentUserId, permissions);
    }

    @Post()
    @RequirePermissions(PermissionKey.VisitorsCreate)
    @ApiOperation({ summary: 'Create visitor invitation' })
    create(
        @Body() dto: CreateVisitorDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.visitorsService.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.VisitorsUpdate)
    @ApiOperation({ summary: 'Update visitor' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateVisitorDto,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('permissions') permissions: string[],
    ) {
        return this.visitorsService.update(id, dto, currentUserId, permissions);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.VisitorsDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft-delete visitor' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('permissions') permissions: string[],
    ) {
        return this.visitorsService.remove(id, currentUserId, permissions);
    }
}
