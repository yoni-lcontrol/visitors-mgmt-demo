import { IsNotEmpty, IsString, IsInt, IsOptional, Matches, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GUID_REGEX } from '../../common/constants/regex.constants';

export class CreateDoorDto {
    @ApiProperty()
    @Matches(GUID_REGEX, { message: 'controllerId must be a valid GUID' })
    @IsNotEmpty()
    controllerId!: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    doorsIndex?: number;

    @ApiProperty({ example: 'Main Entrance' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiPropertyOptional({ example: 0, description: '0=NONE, 1=IN, 2=OUT' })
    @IsOptional()
    @IsInt()
    entryType?: number;

    @ApiPropertyOptional({ example: 'EXT-001' })
    @IsOptional()
    @IsString()
    externalId?: string;

    @ApiPropertyOptional()
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsOptional()
    @Matches(GUID_REGEX, { message: 'stationId must be a valid GUID' })
    stationId?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
