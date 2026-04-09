import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateVisitDto } from './create-visit.dto';

export class UpdateVisitDto extends PartialType(
    OmitType(CreateVisitDto, ['visitors', 'escorts'] as const),
) { }
