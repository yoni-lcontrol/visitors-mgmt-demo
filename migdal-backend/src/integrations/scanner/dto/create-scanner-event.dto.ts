import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScannerEventDto {
    @ApiProperty({ description: 'Unique event ID from the scanner system' })
    @IsString()
    @IsNotEmpty()
    eventId!: string;

    @ApiProperty({ description: 'Event type', example: 'scan_completed' })
    @IsString()
    @IsNotEmpty()
    eventType!: string;

    @ApiProperty({ description: 'ISO 8601 timestamp of when the event occurred' })
    @IsDateString()
    occurredAt!: string;

    @ApiPropertyOptional({ description: 'Scanner device ID' })
    @IsOptional()
    @IsString()
    scannerId?: string;

    @ApiPropertyOptional({ description: 'Type of code detected (barcode, qr)' })
    @IsOptional()
    @IsString()
    codeType?: string;

    @ApiPropertyOptional({ description: 'Scanned code value' })
    @IsOptional()
    @IsString()
    codeValue?: string;

    @ApiPropertyOptional({ description: 'Human-readable description' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ description: 'Correlation ID for request tracing' })
    @IsOptional()
    @IsString()
    correlationId?: string;
}
