import { PartialType } from '@nestjs/swagger';
import { CreateCardholderDto } from './create-cardholder.dto';

export class UpdateCardholderDto extends PartialType(CreateCardholderDto) { }
