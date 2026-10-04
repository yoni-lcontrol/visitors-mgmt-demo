import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsArray,
    IsInt,
    IsDateString,
    IsIn,
    ValidateNested,
    Matches,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitVisitorItemDto } from './visit-visitor-item.dto';
import { VisitEscortItemDto } from './visit-escort-item.dto';
import { GUID_REGEX } from '../../common/constants/regex.constants';

export class VisitRequesterDto {
    @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    @IsString()
    @IsNotEmpty()
    @Matches(GUID_REGEX, { message: 'userId must be a valid GUID' })
    userId!: string;
}

export class CreateVisitDto {
    @ApiProperty({ example: 'Client meeting' })
    @IsString()
    @IsNotEmpty()
    title!: string;

    @ApiPropertyOptional({ example: 'Quarterly review with stakeholders' })
    @IsOptional()
    @IsString()
    purposeOfVisit?: string;

    @ApiPropertyOptional({ example: 'SITE-001' })
    @IsOptional()
    @IsString()
    siteId?: string;

    @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    @IsNotEmpty()
    @Matches(GUID_REGEX, { message: 'buildingId must be a valid GUID' })
    buildingId!: string;

    @ApiProperty({ example: 3 })
    @IsNotEmpty()
    @IsInt()
    floor!: number;

    @ApiProperty({ example: '2026-04-01T06:00:00.000Z', description: 'ISO 8601 UTC datetime' })
    @IsDateString()
    @IsNotEmpty()
    plannedStartTimeUtc!: string;

    @ApiProperty({ example: '2026-04-01T14:00:00.000Z', description: 'ISO 8601 UTC datetime' })
    @IsDateString()
    @IsNotEmpty()
    plannedEndTimeUtc!: string;

    @ApiPropertyOptional({ type: VisitRequesterDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => VisitRequesterDto)
    visitRequester?: VisitRequesterDto;

    @ApiProperty({ type: [VisitVisitorItemDto] })
    @IsArray()
    @ArrayMinSize(1, { message: 'A visit must have at least one visitor' })
    @ValidateNested({ each: true })
    @Type(() => VisitVisitorItemDto)
    visitors!: VisitVisitorItemDto[];

    @ApiProperty({ type: [VisitEscortItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => VisitEscortItemDto)
    escorts!: VisitEscortItemDto[];

    @ApiPropertyOptional({ example: 'excel-import', enum: ['manual', 'excel-import'], description: 'How this visit was submitted. excel-import requires the visits.import permission.' })
    @IsOptional()
    @IsIn(['manual', 'excel-import'])
    source?: 'manual' | 'excel-import';
}
