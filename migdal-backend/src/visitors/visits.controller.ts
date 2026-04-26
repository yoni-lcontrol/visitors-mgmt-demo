import {
    Controller,
    Get,
    Post,
    Put,
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
import { VisitsService } from './visits.service';
import { VisitParticipantService } from './visit-participant.service';
import { VisitStatusService } from './visit-status.service';
import { VisitCheckInCodeService } from './visit-check-in-code.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { AddVisitVisitorsDto } from './dto/add-visit-visitors.dto';
import { AddVisitEscortsDto } from './dto/add-visit-escorts.dto';
import { UpdateVisitVisitorDto } from './dto/update-visit-visitor.dto';
import { UpdateVisitEscortDto } from './dto/update-visit-escort.dto';
import { KioskValidateCodeDto } from './dto/kiosk-validate-code.dto';
import { PrintCardDto } from './dto/print-card.dto';
import { OnSiteQueryDto } from './dto/on-site-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { VisitsQueryDto } from './dto/visits-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { PrintingService } from '../printing/services/printing.service';

@ApiTags('Visits')
@ApiBearerAuth()
@Controller('visits')
export class VisitsController {
    constructor(
        private readonly visitsService: VisitsService,
        private readonly participantService: VisitParticipantService,
        private readonly statusService: VisitStatusService,
        private readonly checkInCodeService: VisitCheckInCodeService,
        private readonly printingService: PrintingService,
    ) { }

    @Post()
    @RequirePermissions(PermissionKey.VisitsCreate)
    @ApiOperation({ summary: 'Create a visit with visitors and escorts' })
    async create(
        @Body() dto: CreateVisitDto,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('permissions') permissions: string[],
        @CurrentUser('roles') roles: string[],
    ) {
        return this.visitsService.createVisit(dto, currentUserId, permissions, roles);
    }

    @Get()
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'List visits (paginated, with optional time filter)' })
    findAll(
        @Query() query: VisitsQueryDto,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('roles') roles: string[],
    ) {
        return this.visitsService.findAllVisits(query, currentUserId, roles);
    }

    @Get('export')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Export visits as Excel' })
    async export(
        @Query() query: VisitsQueryDto,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('roles') roles: string[],
        @Res() res: Response,
    ) {
        const file = await this.visitsService.exportVisitsToExcel(query, currentUserId, roles);
        sendExcelResponse(res, file, 'visits.xlsx');
    }

    @Get('calendar')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Get visits for calendar view by date range' })
    getCalendarVisits(
        @Query('start') start: string,
        @Query('end') end: string,
        @Query('search') search?: string,
        @CurrentUser('sub') currentUserId?: string,
        @CurrentUser('roles') roles?: string[],
    ) {
        return this.visitsService.findVisitsByDateRange(start, end, search, currentUserId, roles);
    }

    @Get('on-site')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Get on-site visitors (arrived/checked-in) for a date' })
    getOnSiteVisitors(@Query() query: OnSiteQueryDto) {
        return this.statusService.findOnSiteVisitors(query);
    }

    @Get('today-summary')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Get today\'s visit summary counts' })
    getTodaySummary(
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('roles') roles: string[],
    ) {
        return this.visitsService.getTodaySummary(currentUserId, roles);
    }

    @Get(':visitId')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Get visit by ID' })
    findOne(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('roles') roles: string[],
    ) {
        return this.visitsService.findVisitById(visitId, currentUserId, roles);
    }

    @Put(':visitId')
    @RequirePermissions(PermissionKey.VisitsUpdate)
    @ApiOperation({ summary: 'Update visit' })
    update(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @Body() dto: UpdateVisitDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.visitsService.updateVisit(visitId, dto, currentUserId);
    }

    @Delete(':visitId')
    @RequirePermissions(PermissionKey.VisitsDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft-delete visit' })
    remove(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('roles') roles: string[],
    ) {
        return this.visitsService.removeVisit(visitId, currentUserId, roles);
    }

    // -- Visit Visitors --

    @Post(':visitId/visitors')
    @RequirePermissions(PermissionKey.VisitsCreate)
    @ApiOperation({ summary: 'Add visitors to a visit' })
    async addVisitors(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @Body() dto: AddVisitVisitorsDto,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('permissions') permissions: string[],
    ) {
        return this.participantService.addVisitVisitors(visitId, dto, currentUserId, permissions);
    }

    @Get(':visitId/visitors')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Get visitors in a visit' })
    async getVisitors(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('roles') roles: string[],
    ) {
        await this.visitsService.findVisitById(visitId, currentUserId, roles);
        return this.participantService.getVisitVisitors(visitId);
    }

    @Patch(':visitId/visitors/:visitVisitorId')
    @RequirePermissions(PermissionKey.VisitsUpdate)
    @ApiOperation({ summary: 'Update a visitor in a visit' })
    updateVisitor(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @Param('visitVisitorId', ParseUUIDPipe) visitVisitorId: string,
        @Body() dto: UpdateVisitVisitorDto,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('permissions') permissions: string[],
    ) {
        return this.participantService.updateVisitVisitor(visitId, visitVisitorId, dto, currentUserId, permissions);
    }

    @Delete(':visitId/visitors/:visitVisitorId')
    @RequirePermissions(PermissionKey.VisitsDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove visitor from visit' })
    removeVisitor(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @Param('visitVisitorId', ParseUUIDPipe) visitVisitorId: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.participantService.removeVisitVisitor(visitId, visitVisitorId, currentUserId);
    }

    // -- Visit Escorts (free text) --

    @Post(':visitId/escorts')
    @RequirePermissions(PermissionKey.VisitsCreate)
    @ApiOperation({ summary: 'Add escorts to a visit' })
    addEscorts(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @Body() dto: AddVisitEscortsDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.participantService.addVisitEscorts(visitId, dto, currentUserId);
    }

    @Get(':visitId/escorts')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Get escorts in a visit' })
    async getEscorts(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('roles') roles: string[],
    ) {
        await this.visitsService.findVisitById(visitId, currentUserId, roles);
        return this.participantService.getVisitEscorts(visitId);
    }

    @Patch(':visitId/escorts/:visitEscortId')
    @RequirePermissions(PermissionKey.VisitsUpdate)
    @ApiOperation({ summary: 'Update an escort in a visit' })
    updateEscort(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @Param('visitEscortId', ParseUUIDPipe) visitEscortId: string,
        @Body() dto: UpdateVisitEscortDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.participantService.updateVisitEscort(visitId, visitEscortId, dto, currentUserId);
    }

    @Delete(':visitId/escorts/:visitEscortId')
    @RequirePermissions(PermissionKey.VisitsDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove escort from visit' })
    removeEscort(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @Param('visitEscortId', ParseUUIDPipe) visitEscortId: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.participantService.removeVisitEscort(visitId, visitEscortId, currentUserId);
    }

    // -- Statuses & History --

    @Get(':visitId/visitor-statuses')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Get current visitor statuses for a visit' })
    async getStatuses(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('roles') roles: string[],
    ) {
        await this.visitsService.findVisitById(visitId, currentUserId, roles);
        return this.statusService.getVisitorStatuses(visitId);
    }

    @Get(':visitId/visitor-history')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Get all access log history for a visit' })
    async getHistory(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('roles') roles: string[],
    ) {
        await this.visitsService.findVisitById(visitId, currentUserId, roles);
        return this.statusService.getVisitHistory(visitId);
    }

    // -- Check-In Codes --

    @Post(':visitId/check-in-codes/generate')
    @RequirePermissions(PermissionKey.VisitsCheckInCodeSend)
    @ApiOperation({ summary: 'Generate and send check-in codes for all visitors in a visit' })
    async generateCheckInCodes(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        const codes = await this.checkInCodeService.generateCodesForVisit(visitId, currentUserId);
        const sendResult = await this.checkInCodeService.sendCodeNotifications(visitId, currentUserId);
        return { codesGenerated: codes.length, ...sendResult };
    }

    @Get(':visitId/check-in-codes')
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'Get check-in codes for a visit' })
    async getCheckInCodes(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @CurrentUser('sub') currentUserId: string,
        @CurrentUser('roles') roles: string[],
    ) {
        await this.visitsService.findVisitById(visitId, currentUserId, roles);
        return this.checkInCodeService.getCodesForVisit(visitId);
    }

    @Post('visit-visitors/:visitVisitorId/check-in-codes/resend')
    @RequirePermissions(PermissionKey.VisitsCheckInCodeSend)
    @ApiOperation({ summary: 'Resend check-in code to a visitor' })
    resendCheckInCode(
        @Param('visitVisitorId', ParseUUIDPipe) visitVisitorId: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.checkInCodeService.resendCode(visitVisitorId, currentUserId);
    }

    @Post('visit-visitors/:visitVisitorId/check-in-codes/regenerate')
    @RequirePermissions(PermissionKey.VisitsCheckInCodeRegenerate)
    @ApiOperation({ summary: 'Regenerate check-in code for a visitor' })
    regenerateCheckInCode(
        @Param('visitVisitorId', ParseUUIDPipe) visitVisitorId: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.checkInCodeService.regenerateCode(visitVisitorId, currentUserId);
    }

    @Post('kiosk/validate-code')
    @ApiOperation({ summary: 'Validate a check-in code at the kiosk' })
    validateKioskCode(@Body() dto: KioskValidateCodeDto) {
        return this.checkInCodeService.validateCode(dto.code);
    }

    @Post('kiosk/check-in')
    @ApiOperation({ summary: 'Check in a visitor via kiosk code' })
    kioskCheckIn(@Body() dto: KioskValidateCodeDto) {
        return this.checkInCodeService.consumeCodeAndCheckIn(dto.code);
    }

    @Post(':visitId/visitors/:visitorId/print-card')
    @HttpCode(HttpStatus.ACCEPTED)
    @RequirePermissions(PermissionKey.VisitsPrintCard)
    @ApiOperation({ summary: 'Request printing a visitor badge card' })
    async printCard(
        @Param('visitId', ParseUUIDPipe) visitId: string,
        @Param('visitorId', ParseUUIDPipe) visitorId: string,
        @Body() dto: PrintCardDto,
        @CurrentUser('sub') userId: string,
    ) {
        return this.printingService.requestPrintCardAndNotify(userId, {
            visitId,
            visitorId,
            cardTemplateId: dto.cardTemplateId,
            printOptions: dto.printOptions,
        });
    }
}
