import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { GUID_REGEX } from '../../common/constants/regex.constants';

export class CreateAdGroupRoleMappingDto {
    @ApiProperty({ example: 'Visitors Operators' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    groupName!: string;

    @ApiProperty({ example: '8fd03af8-2624-4264-b497-fad0f6590534' })
    @IsString()
    @Matches(GUID_REGEX)
    roleId!: string;

    @ApiPropertyOptional({ example: '2f565690-b8ae-42be-9a8b-ef89fd1ab43c' })
    @IsOptional()
    @IsString()
    @Matches(GUID_REGEX)
    adSourceId?: string;

    @ApiPropertyOptional({ example: 'S-1-5-21-1234567890-123456789-1234567890-1010' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    groupExternalId?: string;
}
