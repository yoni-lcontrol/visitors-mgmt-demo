import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { sendExcelResponse } from '../common/utils/excel.util';
import { CreateVehicleModelDto } from './dto/create-vehicle-model.dto';
import { UpdateVehicleModelDto } from './dto/update-vehicle-model.dto';
import { VehicleModelQueryDto } from './dto/vehicle-model-query.dto';
import { VehicleModelsService } from './vehicle-models.service';

@ApiTags('Vehicle Models')
@ApiBearerAuth()
@Controller('settings/vehicle-models')
export class VehicleModelsController {
    constructor(private readonly vehicleModelsService: VehicleModelsService) { }

    @Get()
    @RequirePermissions(PermissionKey.VehicleModelsView)
    @ApiOperation({ summary: 'List all vehicle models (paginated)' })
    findAll(@Query() query: VehicleModelQueryDto) {
        return this.vehicleModelsService.findAll(query);
    }

    @Get('manufacturers')
    @RequirePermissions(PermissionKey.VehicleModelsView)
    @ApiOperation({ summary: 'Get all seeded vehicle manufacturers' })
    getManufacturers() {
        return this.vehicleModelsService.getManufacturers();
    }

    @Get('export')
    @RequirePermissions(PermissionKey.VehicleModelsExport)
    @ApiOperation({ summary: 'Export vehicle models as Excel' })
    async export(
        @Query() query: VehicleModelQueryDto,
        @Res() res: Response,
    ) {
        const file = await this.vehicleModelsService.exportToExcel(query);
        sendExcelResponse(res, file, 'vehicle-models.xlsx');
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.VehicleModelsView)
    @ApiOperation({ summary: 'Get vehicle model by ID' })
    findById(@Param('id', ParseUUIDPipe) id: string) {
        return this.vehicleModelsService.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.VehicleModelsCreate)
    @ApiOperation({ summary: 'Create vehicle model' })
    create(
        @Body() dto: CreateVehicleModelDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.vehicleModelsService.create(dto, currentUserId);
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.VehicleModelsUpdate)
    @ApiOperation({ summary: 'Update vehicle model' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateVehicleModelDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.vehicleModelsService.update(id, dto, currentUserId);
    }

    @Delete(':id')
    @RequirePermissions(PermissionKey.VehicleModelsDelete)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete vehicle model' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.vehicleModelsService.remove(id, currentUserId);
    }
}
