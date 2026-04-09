import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
    @ApiProperty()
    accessToken!: string;

    /** Used internally by the controller to set HttpOnly cookie; not sent in response body. */
    @ApiHideProperty()
    refreshToken!: string;

    @ApiProperty()
    user!: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        email: string | null;
        phone: string | null;
        roles: string[];
        permissions: string[];
    };
}
