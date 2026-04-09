import {
    IsNotEmpty,
    IsString,
    IsEmail,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
