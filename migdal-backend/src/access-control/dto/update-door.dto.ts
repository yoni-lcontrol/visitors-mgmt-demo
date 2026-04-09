import { PartialType } from '@nestjs/swagger';
import { CreateDoorDto } from './create-door.dto';

export class UpdateDoorDto extends PartialType(CreateDoorDto) { }
