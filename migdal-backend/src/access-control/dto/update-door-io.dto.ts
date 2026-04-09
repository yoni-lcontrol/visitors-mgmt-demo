import { PartialType } from '@nestjs/swagger';
import { CreateDoorIoDto } from './create-door-io.dto';

export class UpdateDoorIoDto extends PartialType(CreateDoorIoDto) { }
