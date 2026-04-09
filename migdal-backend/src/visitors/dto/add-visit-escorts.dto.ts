import {
    IsArray,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { VisitEscortItemDto } from './visit-escort-item.dto';

export class AddVisitEscortsDto {
    @ApiProperty({ type: [VisitEscortItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => VisitEscortItemDto)
    escorts!: VisitEscortItemDto[];
}
