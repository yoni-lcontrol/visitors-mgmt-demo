import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders } from 'axios';
import { AccessControlApiService } from './ac-api.service';

function mockAxiosResponse<T>(data: T): AxiosResponse<T> {
    return {
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: new AxiosHeaders() },
    };
}

describe('AccessControlApiService', () => {
    let service: AccessControlApiService;
    let mockHttpService: { post: jest.Mock; get: jest.Mock; put: jest.Mock; delete: jest.Mock };
    let mockConfigService: { get: jest.Mock };

    beforeEach(async () => {
        mockHttpService = {
            post: jest.fn(),
            get: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
        };

        mockConfigService = {
            get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                    ACCESS_CONTROL_REMOTE_URL: 'http://ac-server:8080',
                    ACCESS_CONTROL_CLIENT_ID: 'migdal-backend',
                    ACCESS_CONTROL_CLIENT_SECRET: 'super-secret-key-256-bits-min',
                    APP_URL: 'http://localhost:3000',
                };
                return config[key];
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AccessControlApiService,
                { provide: HttpService, useValue: mockHttpService },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<AccessControlApiService>(AccessControlApiService);
    });

    describe('HMAC signing', () => {
        it('should send x-client-id, x-timestamp, and x-signature headers on POST', async () => {
            mockHttpService.post.mockReturnValue(of(mockAxiosResponse({ success: true })));

            await service.createCardholder({
                firstName: 'John',
                lastName: 'Doe',
                personId: '123',
            });

            expect(mockHttpService.post).toHaveBeenCalledTimes(1);
            const [url, , config] = mockHttpService.post.mock.calls[0];
            expect(url).toBe('http://ac-server:8080/cardholders');
            expect(config.headers['x-client-id']).toBe('migdal-backend');
            expect(config.headers['x-timestamp']).toBeDefined();
            expect(config.headers['x-signature']).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should send HMAC headers on GET requests', async () => {
            mockHttpService.get.mockReturnValue(
                of(mockAxiosResponse({ cardholders: [], totalCount: 0 })),
            );

            await service.downloadCardholders();

            expect(mockHttpService.get).toHaveBeenCalledTimes(1);
            const [, config] = mockHttpService.get.mock.calls[0];
            expect(config.headers['x-client-id']).toBe('migdal-backend');
            expect(config.headers['x-signature']).toMatch(/^[a-f0-9]{64}$/);
        });
    });

    describe('config validation', () => {
        it('should throw BadRequestException when ACCESS_CONTROL_REMOTE_URL is not set', async () => {
            mockConfigService.get.mockReturnValue(undefined);

            await expect(service.downloadCardholders()).rejects.toThrow(BadRequestException);
        });
    });

    describe('triggerFullImport', () => {
        it('should POST to /import, poll status, and return payload', async () => {
            jest.useFakeTimers();
            const mockPayload = { controllers: [{ name: 'C1' }] };

            // POST → returns jobId
            mockHttpService.post.mockReturnValueOnce(of(mockAxiosResponse({ jobId: 'job-1' })));
            // GET status → completed with payload
            mockHttpService.get.mockReturnValueOnce(
                of(mockAxiosResponse({ status: 'Completed', payload: mockPayload })),
            );

            const promise = service.triggerFullImport();
            await jest.advanceTimersByTimeAsync(5001);
            const result = await promise;
            jest.useRealTimers();

            const [url, body] = mockHttpService.post.mock.calls[0];
            expect(url).toBe('http://ac-server:8080/import');
            expect(body).toEqual({ action: 'import' });

            const [getUrl] = mockHttpService.get.mock.calls[0];
            expect(getUrl).toBe('http://ac-server:8080/import/status/job-1');

            expect(result).toEqual(mockPayload);
        });

        it('should throw BadGatewayException on HTTP error', async () => {
            mockHttpService.post.mockReturnValue(
                throwError(() => ({ response: { status: 500, data: { message: 'Server error' } } })),
            );

            await expect(service.triggerFullImport()).rejects.toThrow(BadGatewayException);
        });
    });

    describe('triggerAccessLevelImport', () => {
        it('should POST to /import/access-levels, poll status, and return accessLevelPayload', async () => {
            jest.useFakeTimers();
            const mockPayload = { accessLevels: [{ name: 'VIP' }] };

            // POST → returns jobId
            mockHttpService.post.mockReturnValueOnce(of(mockAxiosResponse({ jobId: 'job-al-1' })));
            // GET status → completed with accessLevelPayload
            mockHttpService.get.mockReturnValueOnce(
                of(mockAxiosResponse({ status: 'Completed', accessLevelPayload: mockPayload })),
            );

            const promise = service.triggerAccessLevelImport();
            await jest.advanceTimersByTimeAsync(5001);
            const result = await promise;
            jest.useRealTimers();

            const [postUrl, postBody] = mockHttpService.post.mock.calls[0];
            expect(postUrl).toBe('http://ac-server:8080/import/access-levels');
            expect(postBody).toEqual({ action: 'import-access-levels' });

            const [getUrl] = mockHttpService.get.mock.calls[0];
            expect(getUrl).toBe('http://ac-server:8080/import/status/job-al-1');

            expect(result).toEqual(mockPayload);
        });

        it('should throw BadGatewayException when job fails', async () => {
            jest.useFakeTimers();
            mockHttpService.post.mockReturnValueOnce(of(mockAxiosResponse({ jobId: 'job-al-fail' })));
            mockHttpService.get.mockReturnValueOnce(
                of(mockAxiosResponse({ status: 'Failed', errorMessage: 'OData unreachable' })),
            );

            const promise = service.triggerAccessLevelImport();
            // Attach rejection handler before advancing timers to avoid unhandled rejection
            const expectation = expect(promise).rejects.toThrow(BadGatewayException);
            await jest.advanceTimersByTimeAsync(5001);
            await expectation;
            jest.useRealTimers();
        });

        it('should throw BadGatewayException on HTTP error', async () => {
            mockHttpService.post.mockReturnValue(
                throwError(() => ({ response: { status: 500, data: { message: 'Server error' } } })),
            );

            await expect(service.triggerAccessLevelImport()).rejects.toThrow(BadGatewayException);
        });

        it('should throw BadGatewayException with descriptive message on ETIMEDOUT', async () => {
            mockHttpService.post.mockReturnValue(
                throwError(() => ({ code: 'ETIMEDOUT', message: 'ETIMEDOUT' })),
            );

            const err = await service.triggerAccessLevelImport().catch(e => e);
            expect(err).toBeInstanceOf(BadGatewayException);
            expect(err.message).toBe('Cannot reach Amadeus service (ETIMEDOUT)');
        });

        it('should throw BadGatewayException with descriptive message on ECONNREFUSED', async () => {
            mockHttpService.post.mockReturnValue(
                throwError(() => ({ code: 'ECONNREFUSED', message: 'ECONNREFUSED' })),
            );

            const err = await service.triggerAccessLevelImport().catch(e => e);
            expect(err).toBeInstanceOf(BadGatewayException);
            expect(err.message).toBe('Cannot reach Amadeus service (ECONNREFUSED)');
        });
    });

    describe('downloadCardholders', () => {
        it('should GET /cardholders with query params', async () => {
            const mockData = { cardholders: [{ personId: '1' }], totalCount: 1 };
            mockHttpService.get.mockReturnValue(of(mockAxiosResponse(mockData)));

            const result = await service.downloadCardholders({ search: 'john', page: 1, limit: 10 });

            expect(result).toEqual(mockData);
            const [, config] = mockHttpService.get.mock.calls[0];
            expect(config.params).toEqual({ search: 'john', page: 1, limit: 10 });
        });
    });

    describe('getCardholder', () => {
        it('should GET /cardholders/:id', async () => {
            const mockCardholder = { firstName: 'John', lastName: 'Doe', personId: '123' };
            mockHttpService.get.mockReturnValue(of(mockAxiosResponse(mockCardholder)));

            const result = await service.getCardholder('ch-1');

            expect(result).toEqual(mockCardholder);
            expect(mockHttpService.get.mock.calls[0][0]).toBe('http://ac-server:8080/cardholders/ch-1');
        });
    });

    describe('createCardholder', () => {
        it('should POST /cardholders', async () => {
            const mockResponse = { success: true, cardholderId: 'new-1' };
            mockHttpService.post.mockReturnValue(of(mockAxiosResponse(mockResponse)));

            const result = await service.createCardholder({
                firstName: 'Jane',
                lastName: 'Doe',
                personId: '456',
            });

            expect(result).toEqual(mockResponse);
            const [url, body] = mockHttpService.post.mock.calls[0];
            expect(url).toBe('http://ac-server:8080/cardholders');
            expect(body).toEqual({ firstName: 'Jane', lastName: 'Doe', personId: '456' });
        });
    });

    describe('updateCardholder', () => {
        it('should PUT /cardholders/:id', async () => {
            const mockResponse = { success: true };
            mockHttpService.put.mockReturnValue(of(mockAxiosResponse(mockResponse)));

            const result = await service.updateCardholder('ch-1', { firstName: 'Updated' });

            expect(result).toEqual(mockResponse);
            expect(mockHttpService.put.mock.calls[0][0]).toBe('http://ac-server:8080/cardholders/ch-1');
            expect(mockHttpService.put.mock.calls[0][1]).toEqual({ firstName: 'Updated' });
        });
    });

    describe('deleteCardholder', () => {
        it('should DELETE /cardholders/:id', async () => {
            const mockResponse = { success: true };
            mockHttpService.delete.mockReturnValue(of(mockAxiosResponse(mockResponse)));

            const result = await service.deleteCardholder('ch-1');

            expect(result).toEqual(mockResponse);
            expect(mockHttpService.delete.mock.calls[0][0]).toBe('http://ac-server:8080/cardholders/ch-1');
        });
    });

    describe('createCardholderBatch', () => {
        it('should POST /cardholders/batch', async () => {
            const mockResponse = { succeeded: 2, failed: 0, errors: [] };
            mockHttpService.post.mockReturnValue(of(mockAxiosResponse(mockResponse)));

            const result = await service.createCardholderBatch([
                { firstName: 'A', lastName: 'B', personId: '1' },
                { firstName: 'C', lastName: 'D', personId: '2' },
            ]);

            expect(result).toEqual(mockResponse);
            const [url, body] = mockHttpService.post.mock.calls[0];
            expect(url).toBe('http://ac-server:8080/cardholders/batch');
            expect(body.cardholders).toHaveLength(2);
        });
    });

    describe('deleteCardholderBatch', () => {
        it('should POST /cardholders/batch-delete', async () => {
            const mockResponse = { succeeded: 2, failed: 0, errors: [] };
            mockHttpService.post.mockReturnValue(of(mockAxiosResponse(mockResponse)));

            const result = await service.deleteCardholderBatch(['ch-1', 'ch-2']);

            expect(result).toEqual(mockResponse);
            const [url, body] = mockHttpService.post.mock.calls[0];
            expect(url).toBe('http://ac-server:8080/cardholders/batch-delete');
            expect(body.ids).toEqual(['ch-1', 'ch-2']);
        });
    });
});
