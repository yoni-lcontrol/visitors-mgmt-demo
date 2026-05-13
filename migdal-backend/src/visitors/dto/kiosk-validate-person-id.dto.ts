import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class KioskValidatePersonIdDto {
    @ApiProperty({ description: 'Person ID (identity number) from scanned document' })
    @IsString()
    @IsNotEmpty()
    personId!: string;
}
