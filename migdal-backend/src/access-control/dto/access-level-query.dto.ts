import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AccessLevelQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({ description: 'Filter by active status (1 = active, 0 = inactive)' })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === '1' || value === 'true' || value === true || value === 1)
    active?: boolean;

    @ApiPropertyOptional({ description: 'Filter by visitor access flag (1 = visitor access, 0 = no visitor access)' })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === '1' || value === 'true' || value === true || value === 1)
    visitorAccess?: boolean;
}
