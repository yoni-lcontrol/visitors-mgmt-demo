import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsArray,
    Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GUID_REGEX } from '../../common/constants/regex.constants';

export class CreateBlacklistDto {
    @ApiProperty({ example: 'John' })
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @ApiProperty({ example: 'Doe' })
    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @ApiProperty({ example: '123456789' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d+$/, { message: 'idNumber must contain only digits' })
    idNumber!: string;

    @ApiPropertyOptional({ example: '0501234567' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiProperty({ example: 'Security violation' })
    @IsString()
    @IsNotEmpty()
    reason!: string;

    @ApiPropertyOptional({ example: 'Additional notes' })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({ example: ['user-uuid-1'], type: [String] })
    @IsOptional()
    @IsArray()
    @Matches(GUID_REGEX, { each: true, message: 'each value in notifyUserIds must be a valid UUID' })
    notifyUserIds?: string[];
}
