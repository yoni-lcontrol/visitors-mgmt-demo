import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsDateString,
    IsIn,
    Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GUID_REGEX } from '../../common/constants/regex.constants';

export class CreateVisitorAccessLogDto {
    @ApiProperty({ description: 'Visit visitor UUID' })
    @Matches(GUID_REGEX, { message: 'visitVisitorId must be a valid GUID' })
    @IsNotEmpty()
    visitVisitorId!: string;

    @ApiProperty({ description: 'Event type: 1=Arrived, 2=CheckedIn, 3=CheckedOut', example: 1 })
    @IsIn([1, 2, 3])
    eventType!: number;

    @ApiPropertyOptional({ example: '2026-04-01T09:15:00Z' })
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsOptional()
    @IsDateString()
    eventTimeUtc?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    siteId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    source?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    deviceId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    gateId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    readerId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string;
}
