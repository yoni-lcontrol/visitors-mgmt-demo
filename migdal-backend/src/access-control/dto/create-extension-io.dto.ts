import { IsNotEmpty, IsString, IsInt, IsOptional, Matches, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GUID_REGEX } from '../../common/constants/regex.constants';

export class CreateExtensionIoDto {
    @ApiProperty()
    @Matches(GUID_REGEX, { message: 'extensionId must be a valid GUID' })
    @IsNotEmpty()
    extensionId!: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    type?: number;

    @ApiProperty({ example: 'Relay Output' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    ioIndex?: number;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    ioState?: number;

    @ApiPropertyOptional({ example: 'EXT-001' })
    @IsOptional()
    @IsString()
    externalId?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
