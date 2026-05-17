import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDoorDto } from './create-door.dto';

describe('CreateDoorDto', () => {
    const validGuid = 'A0000000-0000-0000-0000-000000000001';
    const validPayload = {
        controllerId: validGuid,
        name: 'Main Entrance',
    };

    it('should pass with valid stationId', async () => {
        const dto = plainToInstance(CreateDoorDto, { ...validPayload, stationId: validGuid });
        const errors = await validate(dto);
        const stationErrors = errors.filter(e => e.property === 'stationId');
        expect(stationErrors).toHaveLength(0);
    });

    it('should pass when stationId is omitted', async () => {
        const dto = plainToInstance(CreateDoorDto, validPayload);
        const errors = await validate(dto);
        const stationErrors = errors.filter(e => e.property === 'stationId');
        expect(stationErrors).toHaveLength(0);
    });

    it('should pass when stationId is empty string', async () => {
        const dto = plainToInstance(CreateDoorDto, { ...validPayload, stationId: '' });
        const errors = await validate(dto);
        const stationErrors = errors.filter(e => e.property === 'stationId');
        expect(stationErrors).toHaveLength(0);
    });

    it('should reject invalid GUID stationId', async () => {
        const dto = plainToInstance(CreateDoorDto, { ...validPayload, stationId: 'not-a-guid' });
        const errors = await validate(dto);
        const stationErrors = errors.filter(e => e.property === 'stationId');
        expect(stationErrors.length).toBeGreaterThan(0);
    });

    it('should pass when forEscort is a boolean', async () => {
        const dto = plainToInstance(CreateDoorDto, { ...validPayload, forEscort: true });
        const errors = await validate(dto);
        const forEscortErrors = errors.filter(e => e.property === 'forEscort');
        expect(forEscortErrors).toHaveLength(0);
    });

    it('should pass when forEscort is omitted', async () => {
        const dto = plainToInstance(CreateDoorDto, validPayload);
        const errors = await validate(dto);
        const forEscortErrors = errors.filter(e => e.property === 'forEscort');
        expect(forEscortErrors).toHaveLength(0);
    });
});
