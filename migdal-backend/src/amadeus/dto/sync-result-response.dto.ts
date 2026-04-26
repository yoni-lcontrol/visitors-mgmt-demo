import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncResultResponseDto {
    @ApiProperty()
    success!: boolean;

    @ApiProperty()
    operation!: string;

    @ApiProperty()
    startedUtc!: Date;

    @ApiPropertyOptional()
    completedUtc!: Date | null;

    @ApiPropertyOptional()
    totalReceived?: number;

    @ApiPropertyOptional()
    created?: number;

    @ApiPropertyOptional()
    updated?: number;

    @ApiPropertyOptional()
    unchanged?: number;

    @ApiPropertyOptional()
    skipped?: number;

    @ApiPropertyOptional()
    failed?: number;

    @ApiPropertyOptional()
    errorMessage?: string | null;
}
