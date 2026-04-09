import { PartialType } from '@nestjs/swagger';
import { VisitVisitorItemDto } from './visit-visitor-item.dto';

export class UpdateVisitVisitorDto extends PartialType(VisitVisitorItemDto) { }
