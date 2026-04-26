import { Matches } from 'class-validator';
import { GUID_REGEX } from '../../common/constants/regex.constants';

export class AddPermanentEscortDto {
    @Matches(GUID_REGEX, { message: 'domainId must be a valid GUID' })
    domainId!: string;

    @Matches(GUID_REGEX, { message: 'userId must be a valid GUID' })
    userId!: string;
}
