import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { SectorsService } from './sectors.service';

@ApiTags('Sectors')
@ApiBearerAuth()
@Controller('sectors')
export class SectorsController {
    constructor(private readonly sectorsService: SectorsService) { }

    @Get()
    @RequirePermissions(PermissionKey.VisitsRead)
    @ApiOperation({ summary: 'List active sectors' })
    findAll() {
        return this.sectorsService.findAll();
    }
}
