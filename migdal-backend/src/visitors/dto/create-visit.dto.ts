import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsArray,
    IsEmail,
    IsInt,
    IsDateString,
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
    @ApiProperty({ example: 'David' })
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @ApiProperty({ example: 'Cohen' })
    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @ApiProperty({ example: '+972501234567' })
    @IsString()
    @IsNotEmpty()
    phone!: string;

    @ApiProperty({ example: 'david@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email!: string;
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

    @ApiPropertyOptional({ example: "גרעין א'" })
    @IsOptional()
    @IsString()
    nucleus?: string;

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
}
