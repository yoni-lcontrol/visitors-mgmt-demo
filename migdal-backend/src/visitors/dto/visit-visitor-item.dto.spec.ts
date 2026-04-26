import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { VisitVisitorItemDto } from './visit-visitor-item.dto';

describe('VisitVisitorItemDto', () => {
    const validPayload = {
        firstName: 'John',
        lastName: 'Doe',
        personId: '123456789',
        phone: '+972501234567',
    };

    it('should pass with valid email', async () => {
        const dto = plainToInstance(VisitVisitorItemDto, { ...validPayload, email: 'john@example.com' });
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors).toHaveLength(0);
    });

    it('should pass when email is omitted', async () => {
        const dto = plainToInstance(VisitVisitorItemDto, validPayload);
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors).toHaveLength(0);
    });

    it('should pass when email is empty string', async () => {
        const dto = plainToInstance(VisitVisitorItemDto, { ...validPayload, email: '' });
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors).toHaveLength(0);
    });

    it('should reject invalid email format', async () => {
        const dto = plainToInstance(VisitVisitorItemDto, { ...validPayload, email: 'not-valid' });
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors.length).toBeGreaterThan(0);
    });

    it('should pass when hasVehicle is false without carNumber/vehicleType', async () => {
        const dto = plainToInstance(VisitVisitorItemDto, { ...validPayload, hasVehicle: false });
        const errors = await validate(dto);
        const vehicleErrors = errors.filter(e => ['carNumber', 'vehicleType'].includes(e.property));
        expect(vehicleErrors).toHaveLength(0);
    });

    it('should require carNumber when hasVehicle is true', async () => {
        const dto = plainToInstance(VisitVisitorItemDto, { ...validPayload, hasVehicle: true, vehicleType: 'private' });
        const errors = await validate(dto);
        const carErrors = errors.filter(e => e.property === 'carNumber');
        expect(carErrors.length).toBeGreaterThan(0);
    });

    it('should require vehicleType when hasVehicle is true', async () => {
        const dto = plainToInstance(VisitVisitorItemDto, { ...validPayload, hasVehicle: true, carNumber: 'ABC123' });
        const errors = await validate(dto);
        const typeErrors = errors.filter(e => e.property === 'vehicleType');
        expect(typeErrors.length).toBeGreaterThan(0);
    });

    it('should pass with valid vehicle fields when hasVehicle is true', async () => {
        const dto = plainToInstance(VisitVisitorItemDto, {
            ...validPayload, hasVehicle: true, carNumber: 'ABC123', vehicleType: 'private',
        });
        const errors = await validate(dto);
        const vehicleErrors = errors.filter(e => ['carNumber', 'vehicleType'].includes(e.property));
        expect(vehicleErrors).toHaveLength(0);
    });

    it('should reject invalid vehicleType enum value', async () => {
        const dto = plainToInstance(VisitVisitorItemDto, {
            ...validPayload, hasVehicle: true, carNumber: 'ABC123', vehicleType: 'spaceship',
        });
        const errors = await validate(dto);
        const typeErrors = errors.filter(e => e.property === 'vehicleType');
        expect(typeErrors.length).toBeGreaterThan(0);
    });

    describe('phone', () => {
        it('should pass with valid phone', async () => {
            const dto = plainToInstance(VisitVisitorItemDto, validPayload);
            const errors = await validate(dto);
            const phoneErrors = errors.filter(e => e.property === 'phone');
            expect(phoneErrors).toHaveLength(0);
        });

        it('should fail when phone is omitted', async () => {
            const { phone, ...rest } = validPayload;
            const dto = plainToInstance(VisitVisitorItemDto, rest);
            const errors = await validate(dto);
            const phoneErrors = errors.filter(e => e.property === 'phone');
            expect(phoneErrors.length).toBeGreaterThan(0);
        });

        it('should fail when phone is empty string', async () => {
            const dto = plainToInstance(VisitVisitorItemDto, { ...validPayload, phone: '' });
            const errors = await validate(dto);
            const phoneErrors = errors.filter(e => e.property === 'phone');
            expect(phoneErrors.length).toBeGreaterThan(0);
        });
    });

    describe('personId', () => {
        it('should pass with numeric personId', async () => {
            const dto = plainToInstance(VisitVisitorItemDto, validPayload);
            const errors = await validate(dto);
            const pidErrors = errors.filter(e => e.property === 'personId');
            expect(pidErrors).toHaveLength(0);
        });

        it('should reject non-numeric personId', async () => {
            const dto = plainToInstance(VisitVisitorItemDto, { ...validPayload, personId: 'ABC' });
            const errors = await validate(dto);
            const pidErrors = errors.filter(e => e.property === 'personId');
            expect(pidErrors.length).toBeGreaterThan(0);
        });

        it('should reject personId with special characters', async () => {
            const dto = plainToInstance(VisitVisitorItemDto, { ...validPayload, personId: '123-456' });
            const errors = await validate(dto);
            const pidErrors = errors.filter(e => e.property === 'personId');
            expect(pidErrors.length).toBeGreaterThan(0);
        });
    });
});
