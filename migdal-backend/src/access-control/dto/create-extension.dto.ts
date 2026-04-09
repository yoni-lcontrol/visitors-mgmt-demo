import { IsNotEmpty, IsString, IsInt, IsOptional, Matches, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GUID_REGEX } from '../../common/constants/regex.constants';

export class CreateExtensionDto {
    @ApiProperty()
    @Matches(GUID_REGEX, { message: 'controllerId must be a valid GUID' })
    @IsNotEmpty()
    controllerId!: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    type?: number;

    @ApiProperty({ example: 'Extension Board A' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    extensionIndex?: number;

    @ApiPropertyOptional({ example: 'EXT-001' })
    @IsOptional()
    @IsString()
    externalId?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
