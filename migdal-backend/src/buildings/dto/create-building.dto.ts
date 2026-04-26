import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsArray, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GUID_REGEX } from '../../common/constants/regex.constants';

export class CreateBuildingDto {
    @ApiProperty({ example: 'Building A' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiPropertyOptional({ example: '123 Main St, Tel Aviv' })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @ApiPropertyOptional({ description: 'Array of access level IDs to assign to the building', type: [String] })
    @IsOptional()
    @IsArray()
    @Matches(GUID_REGEX, { each: true, message: 'each value in accessLevelIds must be a GUID' })
    accessLevelIds?: string[];
}
