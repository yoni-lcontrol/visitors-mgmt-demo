import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AmadeusControllerResponseDto {
    @ApiProperty()
    id!: string;

    @ApiPropertyOptional()
    externalId!: string | null;

    @ApiPropertyOptional()
    amadeusUid!: string | null;

    @ApiProperty()
    name!: string;

    @ApiPropertyOptional()
    isActive!: boolean;
}

export class AmadeusDoorResponseDto {
    @ApiProperty()
    id!: string;

    @ApiPropertyOptional()
    externalId!: string | null;

    @ApiPropertyOptional()
    amadeusUid!: string | null;

    @ApiProperty()
    name!: string;

    @ApiPropertyOptional()
    controllerExternalId!: string | null;
}

export class AmadeusDoorIoResponseDto {
    @ApiProperty()
    id!: string;

    @ApiPropertyOptional()
    externalId!: string | null;

    @ApiPropertyOptional()
    amadeusUid!: string | null;

    @ApiProperty()
    name!: string;

    @ApiPropertyOptional()
    ioType!: string | null;

    @ApiPropertyOptional()
    direction!: string | null;

    @ApiPropertyOptional()
    controllerExternalId!: string | null;
}

export class AmadeusExtensionResponseDto {
    @ApiProperty()
    id!: string;

    @ApiPropertyOptional()
    externalId!: string | null;

    @ApiPropertyOptional()
    amadeusUid!: string | null;

    @ApiProperty()
    name!: string;

    @ApiPropertyOptional()
    controllerExternalId!: string | null;
}

export class AmadeusExtensionIoResponseDto {
    @ApiProperty()
    id!: string;

    @ApiPropertyOptional()
    externalId!: string | null;

    @ApiPropertyOptional()
    amadeusUid!: string | null;

    @ApiProperty()
    name!: string;

    @ApiPropertyOptional()
    ioType!: string | null;

    @ApiPropertyOptional()
    direction!: string | null;

    @ApiPropertyOptional()
    extensionExternalId!: string | null;

    @ApiPropertyOptional()
    controllerExternalId!: string | null;
}
