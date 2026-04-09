import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePrinterEventDto {
    @ApiProperty({ description: 'Unique event ID from the printer system' })
    @IsString()
    @IsNotEmpty()
    eventId!: string;

    @ApiProperty({ description: 'Event type', example: 'print_completed' })
    @IsString()
    @IsNotEmpty()
    eventType!: string;

    @ApiProperty({ description: 'ISO 8601 timestamp of when the event occurred' })
    @IsDateString()
    occurredAt!: string;

    @ApiPropertyOptional({ description: 'Printer device ID' })
    @IsOptional()
    @IsString()
    printerId?: string;

    @ApiPropertyOptional({ description: 'Print job ID' })
    @IsOptional()
    @IsString()
    jobId?: string;

    @ApiPropertyOptional({ description: 'Document or badge template name' })
    @IsOptional()
    @IsString()
    documentName?: string;

    @ApiPropertyOptional({ description: 'Error details for failed events' })
    @IsOptional()
    @IsString()
    errorDetails?: string;

    @ApiPropertyOptional({ description: 'Human-readable description' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ description: 'Correlation ID for request tracing' })
    @IsOptional()
    @IsString()
    correlationId?: string;
}
