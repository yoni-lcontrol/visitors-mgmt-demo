import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAccessControlEventDto {
    @ApiProperty({ description: 'Unique event ID from the external system' })
    @IsString()
    @IsNotEmpty()
    eventId!: string;

    @ApiProperty({ description: 'Event type', example: 'access_granted' })
    @IsString()
    @IsNotEmpty()
    eventType!: string;

    @ApiProperty({ description: 'ISO 8601 timestamp of when the event occurred' })
    @IsDateString()
    occurredAt!: string;

    @ApiPropertyOptional({ description: 'Door or reader ID from the external system' })
    @IsOptional()
    @IsString()
    doorId?: string;

    @ApiPropertyOptional({ description: 'Controller ID from the external system' })
    @IsOptional()
    @IsString()
    controllerId?: string;

    @ApiPropertyOptional({ description: 'Card or badge number used' })
    @IsOptional()
    @IsString()
    cardNumber?: string;

    @ApiPropertyOptional({ description: 'Person identifier (employee/visitor ID)' })
    @IsOptional()
    @IsString()
    personId?: string;

    @ApiPropertyOptional({ description: 'Human-readable description' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ description: 'Correlation ID for request tracing' })
    @IsOptional()
    @IsString()
    correlationId?: string;
}
