import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

describe('HealthController', () => {
    let controller: HealthController;
    let mockHealthCheckService: Partial<HealthCheckService>;
    let mockTypeOrmIndicator: Partial<TypeOrmHealthIndicator>;

    beforeEach(async () => {
        mockHealthCheckService = {
            check: jest.fn().mockImplementation((indicators) =>
                Promise.resolve({
                    status: 'ok',
                    info: { database: { status: 'up' } },
                    details: { database: { status: 'up' } },
                }),
            ),
        };

        mockTypeOrmIndicator = {
            pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [
                { provide: HealthCheckService, useValue: mockHealthCheckService },
                { provide: TypeOrmHealthIndicator, useValue: mockTypeOrmIndicator },
            ],
        }).compile();

        controller = module.get<HealthController>(HealthController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should return healthy status when database is up', async () => {
        const result = await controller.check();

        expect(result).toEqual({
            status: 'ok',
            info: { database: { status: 'up' } },
            details: { database: { status: 'up' } },
        });
        expect(mockHealthCheckService.check).toHaveBeenCalledWith([
            expect.any(Function),
        ]);
    });

    it('should invoke the database ping check indicator', async () => {
        // Extract and call the indicator function passed to health.check
        await controller.check();

        const indicators = (mockHealthCheckService.check as jest.Mock).mock.calls[0][0];
        await indicators[0]();

        expect(mockTypeOrmIndicator.pingCheck).toHaveBeenCalledWith('database');
    });
});
