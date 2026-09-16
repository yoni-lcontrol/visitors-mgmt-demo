import {
    IsNotEmpty,
    IsString,
    IsEmail,
    IsOptional,
    Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GUID_REGEX } from '../../common/constants/regex.constants';

export class VisitEscortItemDto {
    @ApiProperty({ example: 'Sarah' })
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @ApiProperty({ example: 'Levi' })
    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @ApiProperty({ example: '+972509876543' })
    @IsString()
    @IsNotEmpty()
    phone!: string;

    @ApiProperty({ example: 'sarah@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @ApiPropertyOptional({ example: 'Security' })
    @IsOptional()
    @IsString()
    sector?: string;

    @ApiPropertyOptional({ description: 'Links this escort to a real system user — required for badge-based escort/guest pairing at forEscort doors' })
    @IsOptional()
    @Matches(GUID_REGEX, { message: 'userId must be a valid GUID' })
    userId?: string;
}
