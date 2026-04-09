import { PartialType } from '@nestjs/swagger';
import { VisitEscortItemDto } from './visit-escort-item.dto';

export class UpdateVisitEscortDto extends PartialType(VisitEscortItemDto) { }
