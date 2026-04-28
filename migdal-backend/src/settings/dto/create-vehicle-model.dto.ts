import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateVehicleModelDto {
    @ApiProperty({ example: 'Toyota' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    manufacturer!: string;

    @ApiProperty({ example: 'Corolla' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    model!: string;
}
