import {
    IsString,
    IsNotEmpty,
    IsBoolean,
    IsOptional,
    IsDateString,
    IsInt,
    IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAmadeusEventDto {
    @ApiProperty({ description: 'Source system identifier', example: 'Amadeus8' })
    @IsString()
    @IsNotEmpty()
    sourceSystem!: string;

    @ApiProperty({ description: 'Original SignalR method name', example: 'AccessEventArrived' })
    @IsString()
    @IsNotEmpty()
    signalRMethod!: string;

    @ApiProperty({ description: 'Mapped internal event type', example: 'Door.LegalCard' })
    @IsString()
    @IsNotEmpty()
    internalEventType!: string;

    @ApiProperty({ description: 'Whether the event represents an active state' })
    @IsBoolean()
    isActive!: boolean;

    @ApiProperty({ description: 'UTC timestamp when the event occurred' })
    @IsDateString()
    occurredUtc!: string;

    @ApiProperty({ description: 'UTC timestamp when the event was received by Amadeus' })
    @IsDateString()
    receivedUtc!: string;

    @ApiPropertyOptional({ description: 'External event identifier' })
    @IsOptional()
    @IsString()
    externalEventId?: string;

    @ApiPropertyOptional({ description: 'Event UID from Amadeus' })
    @IsOptional()
    @IsString()
    eventUid?: string;

    @ApiPropertyOptional({ description: 'Log ID from Amadeus' })
    @IsOptional()
    @IsNumber()
    logId?: number;

    @ApiPropertyOptional({ description: 'Numeric event type code from Amadeus' })
    @IsOptional()
    @IsInt()
    eventTypeCode?: number;

    @ApiPropertyOptional({ description: 'External ID of the controller' })
    @IsOptional()
    @IsString()
    controllerExternalId?: string;

    @ApiPropertyOptional({ description: 'External ID of the target object (door, extension, etc.)' })
    @IsOptional()
    @IsString()
    objectExternalId?: string;

    @ApiPropertyOptional({ description: 'Equipment kind (Controller, Door, Extension, etc.)' })
    @IsOptional()
    @IsString()
    equipmentKind?: string;

    @ApiPropertyOptional({ description: 'Human-readable equipment name' })
    @IsOptional()
    @IsString()
    equipmentName?: string;

    @ApiPropertyOptional({ description: 'Reader UID from Amadeus' })
    @IsOptional()
    @IsString()
    readerUid?: string;

    @ApiPropertyOptional({ description: 'Input UID from Amadeus' })
    @IsOptional()
    @IsString()
    inputUid?: string;

    @ApiPropertyOptional({ description: 'Output UID from Amadeus' })
    @IsOptional()
    @IsString()
    outputUid?: string;

    @ApiPropertyOptional({ description: 'Cardholder UID from Amadeus' })
    @IsOptional()
    @IsString()
    cardholderUid?: string;

    @ApiPropertyOptional({ description: 'Cardholder first name from Amadeus' })
    @IsOptional()
    @IsString()
    cardholderFirstName?: string;

    @ApiPropertyOptional({ description: 'Cardholder last name from Amadeus' })
    @IsOptional()
    @IsString()
    cardholderLastName?: string;

    @ApiPropertyOptional({ description: 'Card code used for access' })
    @IsOptional()
    @IsString()
    cardCode?: string;

    @ApiPropertyOptional({ description: 'Car registration number' })
    @IsOptional()
    @IsString()
    carRegistrationNum?: string;

    @ApiPropertyOptional({ description: 'Access denied reason code' })
    @IsOptional()
    @IsInt()
    accessDeniedCode?: number;

    @ApiProperty({ description: 'Raw JSON payload from the original Amadeus event' })
    @IsString()
    @IsNotEmpty()
    rawPayloadJson!: string;
}
