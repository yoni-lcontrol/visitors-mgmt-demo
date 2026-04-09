import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestSmsDto {
    @ApiProperty({ example: 'visit_created' })
    @IsString()
    @IsNotEmpty()
    event!: string;

    @ApiProperty({ example: 'ביקור חדש: {{visit.title}} מתוכנן ל-{{visit.startTime}}.' })
    @IsString()
    @IsNotEmpty()
    template!: string;

    @ApiProperty({ example: '+972501234567' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\+?\d{7,15}$/, { message: 'Invalid phone number format' })
    phone!: string;
}
