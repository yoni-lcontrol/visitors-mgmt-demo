import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EntraLoginDto {
    @ApiProperty({ description: 'Microsoft Entra access token received from MSAL for this API audience' })
    @IsString()
    @IsNotEmpty()
    accessToken!: string;
}
