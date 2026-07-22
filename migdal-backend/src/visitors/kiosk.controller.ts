import {
    Controller,
    Post,
    Body,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { VisitCheckInCodeService } from './visit-check-in-code.service';
import { PrintingService } from '../printing/services/printing.service';
import { KioskValidateCodeDto } from './dto/kiosk-validate-code.dto';
import { KioskValidatePersonIdDto } from './dto/kiosk-validate-person-id.dto';
import { KioskArriveByPersonIdDto } from './dto/kiosk-check-in-by-person-id.dto';
import { KioskPrintCardDto } from './dto/kiosk-print-card.dto';
import { KioskAuth } from '../common/decorators/kiosk-auth.decorator';

@ApiTags('Kiosk')
@KioskAuth()
@Controller('visits/kiosk')
export class KioskController {
    constructor(
        private readonly checkInCodeService: VisitCheckInCodeService,
        private readonly printingService: PrintingService,
    ) { }

    @Post('validate-code')
    @ApiOperation({ summary: 'Validate a check-in code at the kiosk' })
    validateCode(@Body() dto: KioskValidateCodeDto) {
        return this.checkInCodeService.validateCode(dto.code);
    }

    @Post('validate-person-id')
    @ApiOperation({ summary: 'Find today\'s visit by person ID (scanned document)' })
    validatePersonId(@Body() dto: KioskValidatePersonIdDto) {
        return this.checkInCodeService.findVisitByPersonId(dto.personId, dto.identifyNumber);
    }

    @Post('arrive')
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Register visitor arrival via person ID (kiosk scan)' })
    arrive(
        @Body() dto: KioskArriveByPersonIdDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        return this.checkInCodeService.arriveByPersonId(dto.visitId, dto.visitorId, dto.personId, file, dto.workstationCode);
    }

    @Post('print-card')
    @ApiOperation({ summary: 'Build a print payload for the kiosk to send to its paired printer directly' })
    printCard(@Body() dto: KioskPrintCardDto) {
        return this.printingService.requestKioskPrintCard(
            dto.workstationCode,
            dto.visitId,
            dto.visitorId,
            dto.cardTemplateId,
        );
    }
}
