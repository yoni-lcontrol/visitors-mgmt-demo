import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KioskValidatePersonIdDto {
    @ApiProperty({ description: 'Person ID (MRZ document number) from scanned document' })
    @IsString()
    @IsNotEmpty()
    personId!: string;

    @ApiPropertyOptional({ description: 'Identity number (Israeli ID / ת.ז.) from scanned document' })
    @IsString()
    @IsOptional()
    identifyNumber?: string;
}
