import {
    IsNotEmpty,
    IsString,
    IsEmail,
    IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}
