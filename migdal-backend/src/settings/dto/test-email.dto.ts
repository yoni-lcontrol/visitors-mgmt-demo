import { IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestEmailDto {
    @ApiProperty({ example: 'visit_created' })
    @IsString()
    @IsNotEmpty()
    event!: string;

    @ApiProperty({ example: 'ביקור חדש: {{visit.title}}' })
    @IsString()
    @IsNotEmpty()
    subject!: string;

    @ApiProperty({ example: '<h1>ביקור חדש</h1><p>{{visit.title}}</p>' })
    @IsString()
    @IsNotEmpty()
    bodyHtml!: string;

    @ApiProperty({ example: 'test@example.com' })
    @IsEmail()
    email!: string;
}
