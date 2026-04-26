import {
    Controller,
    Post,
    Get,
    Body,
    Req,
    Res,
    UseGuards,
    HttpCode,
    HttpStatus,
    UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { EntraIdService } from './entra-id.service';
import { LoginDto } from './dto/login.dto';
import { EntraLoginDto } from './dto/entra-login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { ConfigService } from '@nestjs/config';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly entraIdService: EntraIdService,
        private readonly configService: ConfigService,
    ) { }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with username and password' })
    async login(
        @Body() dto: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.authService.login(
            dto,
            req.headers['user-agent'],
            req.ip,
        );

        // Set refresh token as HttpOnly cookie
        const refreshDays = this.configService.get<number>('JWT_REFRESH_EXPIRATION_DAYS', 7);
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: this.configService.get('APP_ENV') === 'production',
            sameSite: 'strict',
            maxAge: refreshDays * 24 * 60 * 60 * 1000,
            path: '/api/auth',
        });

        return {
            accessToken: result.accessToken,
            user: result.user,
        };
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Logout and revoke refresh token' })
    async logout(
        @CurrentUser('sub') userId: string,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const refreshToken = req.cookies?.['refreshToken'];
        await this.authService.logout(userId, refreshToken);

        res.clearCookie('refreshToken', { path: '/api/auth' });

        return { message: 'Logged out successfully' };
    }

    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const oldRefreshToken = req.cookies?.['refreshToken'];
        if (!oldRefreshToken) {
            throw new UnauthorizedException('No refresh token provided');
        }

        const result = await this.authService.refreshTokens(
            oldRefreshToken,
            req.headers['user-agent'],
            req.ip,
        );

        const refreshDays = this.configService.get<number>('JWT_REFRESH_EXPIRATION_DAYS', 7);
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: this.configService.get('APP_ENV') === 'production',
            sameSite: 'strict',
            maxAge: refreshDays * 24 * 60 * 60 * 1000,
            path: '/api/auth',
        });

        return {
            accessToken: result.accessToken,
            user: result.user,
        };
    }

    @Get('me')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current authenticated user' })
    async me(@CurrentUser() user: JwtPayload) {
        return this.authService.getCurrentUser(user.sub);
    }

    @Public()
    @Post('entra-login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with Microsoft Entra ID token' })
    async entraLogin(
        @Body() dto: EntraLoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.authService.loginWithEntra(
            dto.accessToken,
            req.headers['user-agent'],
            req.ip,
        );

        const refreshDays = this.configService.get<number>('JWT_REFRESH_EXPIRATION_DAYS', 7);
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: this.configService.get('APP_ENV') === 'production',
            sameSite: 'strict',
            maxAge: refreshDays * 24 * 60 * 60 * 1000,
            path: '/api/auth',
        });

        return {
            accessToken: result.accessToken,
            user: result.user,
        };
    }

    @Public()
    @Get('entra-config')
    @ApiOperation({ summary: 'Get Microsoft Entra ID client configuration' })
    entraConfig() {
        const config = this.entraIdService.getConfig();
        return {
            enabled: this.entraIdService.isConfigured(),
            clientId: config.clientId || null,
            tenantId: config.tenantId || null,
            authority: config.authority || null,
            redirectUri: config.redirectUri || null,
            postLogoutRedirectUri: config.postLogoutRedirectUri || null,
            apiAudience: config.apiAudience || null,
        };
    }
}
