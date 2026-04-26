import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateVisitDto } from './create-visit.dto';

describe('CreateVisitDto', () => {
    const validPayload = {
        title: 'Test Visit',
        buildingId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        floor: 3,
        plannedStartTimeUtc: '2026-04-10T06:00:00.000Z',
        plannedEndTimeUtc: '2026-04-10T14:00:00.000Z',
        visitRequester: {
            firstName: 'John',
            lastName: 'Doe',
            phone: '+972501234567',
            email: 'john@example.com',
        },
        visitors: [
            {
                firstName: 'Jane',
                lastName: 'Smith',
                personId: '123456789',
                phone: '+972509876543',
            },
        ],
    };

    describe('buildingId', () => {
        it('should pass when buildingId is a valid GUID', async () => {
            const dto = plainToInstance(CreateVisitDto, validPayload);
            const errors = await validate(dto);
            const buildingErrors = errors.filter(e => e.property === 'buildingId');
            expect(buildingErrors).toHaveLength(0);
        });

        it('should fail when buildingId is omitted', async () => {
            const { buildingId, ...rest } = validPayload;
            const dto = plainToInstance(CreateVisitDto, rest);
            const errors = await validate(dto);
            const buildingErrors = errors.filter(e => e.property === 'buildingId');
            expect(buildingErrors.length).toBeGreaterThan(0);
        });

        it('should fail when buildingId is empty string', async () => {
            const dto = plainToInstance(CreateVisitDto, { ...validPayload, buildingId: '' });
            const errors = await validate(dto);
            const buildingErrors = errors.filter(e => e.property === 'buildingId');
            expect(buildingErrors.length).toBeGreaterThan(0);
        });

        it('should fail when buildingId is an invalid GUID', async () => {
            const dto = plainToInstance(CreateVisitDto, { ...validPayload, buildingId: 'not-a-guid' });
            const errors = await validate(dto);
            const buildingErrors = errors.filter(e => e.property === 'buildingId');
            expect(buildingErrors.length).toBeGreaterThan(0);
        });
    });

    describe('floor', () => {
        it('should pass when floor is a valid integer', async () => {
            const dto = plainToInstance(CreateVisitDto, validPayload);
            const errors = await validate(dto);
            const floorErrors = errors.filter(e => e.property === 'floor');
            expect(floorErrors).toHaveLength(0);
        });

        it('should pass when floor is zero', async () => {
            const dto = plainToInstance(CreateVisitDto, { ...validPayload, floor: 0 });
            const errors = await validate(dto);
            const floorErrors = errors.filter(e => e.property === 'floor');
            expect(floorErrors).toHaveLength(0);
        });

        it('should pass when floor is negative', async () => {
            const dto = plainToInstance(CreateVisitDto, { ...validPayload, floor: -1 });
            const errors = await validate(dto);
            const floorErrors = errors.filter(e => e.property === 'floor');
            expect(floorErrors).toHaveLength(0);
        });

        it('should fail when floor is omitted', async () => {
            const { floor, ...rest } = validPayload;
            const dto = plainToInstance(CreateVisitDto, rest);
            const errors = await validate(dto);
            const floorErrors = errors.filter(e => e.property === 'floor');
            expect(floorErrors.length).toBeGreaterThan(0);
        });

        it('should fail when floor is not an integer', async () => {
            const dto = plainToInstance(CreateVisitDto, { ...validPayload, floor: 'abc' });
            const errors = await validate(dto);
            const floorErrors = errors.filter(e => e.property === 'floor');
            expect(floorErrors.length).toBeGreaterThan(0);
        });
    });

    describe('visitRequester', () => {
        it('should pass when visitRequester is provided with valid data', async () => {
            const dto = plainToInstance(CreateVisitDto, validPayload);
            const errors = await validate(dto);
            const requesterErrors = errors.filter(e => e.property === 'visitRequester');
            expect(requesterErrors).toHaveLength(0);
        });

        it('should pass when visitRequester is omitted (optional)', async () => {
            const { visitRequester, ...rest } = validPayload;
            const dto = plainToInstance(CreateVisitDto, rest);
            const errors = await validate(dto);
            const requesterErrors = errors.filter(e => e.property === 'visitRequester');
            expect(requesterErrors).toHaveLength(0);
        });

        it('should fail when visitRequester has invalid email', async () => {
            const dto = plainToInstance(CreateVisitDto, {
                ...validPayload,
                visitRequester: { ...validPayload.visitRequester, email: 'not-an-email' },
            });
            const errors = await validate(dto);
            const requesterErrors = errors.filter(e => e.property === 'visitRequester');
            expect(requesterErrors.length).toBeGreaterThan(0);
        });
    });
});
