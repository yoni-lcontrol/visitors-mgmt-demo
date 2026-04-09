import {
    IsArray,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { VisitVisitorItemDto } from './visit-visitor-item.dto';

export class AddVisitVisitorsDto {
    @ApiProperty({ type: [VisitVisitorItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => VisitVisitorItemDto)
    visitors!: VisitVisitorItemDto[];
}
