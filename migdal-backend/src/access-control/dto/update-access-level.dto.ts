import { PartialType } from '@nestjs/swagger';
import { CreateAccessLevelDto } from './create-access-level.dto';

export class UpdateAccessLevelDto extends PartialType(CreateAccessLevelDto) { }
