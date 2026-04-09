import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEnrollmentTokenDto {
    @ApiProperty({ description: 'Provider type for the agent', enum: ['printer', 'scanner'] })
    @IsString()
    @IsNotEmpty()
    @IsIn(['printer', 'scanner'])
    providerType!: string;
}
