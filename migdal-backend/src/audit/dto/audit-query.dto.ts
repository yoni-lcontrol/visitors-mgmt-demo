import { IsOptional, IsString, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AuditQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({ description: 'Filter by module (e.g. auth, visitors, users)' })
    @IsOptional()
    @IsString()
    module?: string;

    @ApiPropertyOptional({ description: 'Filter by action (e.g. CREATE, UPDATE, DELETE, LOGIN)' })
    @IsOptional()
    @IsString()
    action?: string;

    @ApiPropertyOptional({ description: 'Filter by entity type (e.g. User, Visit, Role)' })
    @IsOptional()
    @IsString()
    entity?: string;

    @ApiPropertyOptional({ description: 'Filter by performing user ID' })
    @IsOptional()
    @IsString()
    userId?: string;

    @ApiPropertyOptional({ description: 'Filter from date (ISO 8601)' })
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @ApiPropertyOptional({ description: 'Filter to date (ISO 8601)' })
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsOptional()
    @IsDateString()
    dateTo?: string;
}
