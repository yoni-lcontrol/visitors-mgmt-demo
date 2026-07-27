import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EntraIdService } from './entra-id.service';
import { KerberosService } from './kerberos.service';
import { KerberosSsoMiddleware } from './middleware/kerberos-sso.middleware';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { RefreshToken } from './entities/refresh-token.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_ACCESS_SECRET'),
                signOptions: {
                    expiresIn: configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
                },
            }),
        }),
        TypeOrmModule.forFeature([RefreshToken, AdConfiguration]),
        UsersModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, EntraIdService, KerberosService, JwtStrategy, JwtRefreshStrategy],
    exports: [AuthService, EntraIdService, KerberosService],
})
export class AuthModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(KerberosSsoMiddleware)
            .forRoutes({ path: 'auth/kerberos-login', method: RequestMethod.GET });
    }
}
