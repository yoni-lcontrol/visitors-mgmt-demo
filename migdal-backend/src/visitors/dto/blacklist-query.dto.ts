import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class BlacklistQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({ enum: ['person', 'vehicle'] })
    @IsOptional()
    @IsIn(['person', 'vehicle'])
    type?: 'person' | 'vehicle';
}
