import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class KioskValidateCodeDto {
    @ApiProperty({ description: '6-digit numeric check-in code', example: '012345' })
    @IsString()
    @Length(6, 6)
    @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 numeric digits' })
    code!: string;
}
