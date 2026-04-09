import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateVisitorDto } from './create-visitor.dto';

describe('CreateVisitorDto', () => {
    const validPayload = {
        personId: '12345678',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+972501234567',
    };

    it('should pass with valid email', async () => {
        const dto = plainToInstance(CreateVisitorDto, { ...validPayload, email: 'jane@example.com' });
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors).toHaveLength(0);
    });

    it('should pass when email is omitted', async () => {
        const dto = plainToInstance(CreateVisitorDto, validPayload);
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors).toHaveLength(0);
    });

    it('should pass when email is empty string', async () => {
        const dto = plainToInstance(CreateVisitorDto, { ...validPayload, email: '' });
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors).toHaveLength(0);
    });

    it('should reject invalid email format', async () => {
        const dto = plainToInstance(CreateVisitorDto, { ...validPayload, email: 'bad-email' });
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors.length).toBeGreaterThan(0);
    });

    describe('phone', () => {
        it('should pass with valid phone', async () => {
            const dto = plainToInstance(CreateVisitorDto, validPayload);
            const errors = await validate(dto);
            const phoneErrors = errors.filter(e => e.property === 'phone');
            expect(phoneErrors).toHaveLength(0);
        });

        it('should fail when phone is omitted', async () => {
            const { phone, ...rest } = validPayload;
            const dto = plainToInstance(CreateVisitorDto, rest);
            const errors = await validate(dto);
            const phoneErrors = errors.filter(e => e.property === 'phone');
            expect(phoneErrors.length).toBeGreaterThan(0);
        });

        it('should fail when phone is empty string', async () => {
            const dto = plainToInstance(CreateVisitorDto, { ...validPayload, phone: '' });
            const errors = await validate(dto);
            const phoneErrors = errors.filter(e => e.property === 'phone');
            expect(phoneErrors.length).toBeGreaterThan(0);
        });
    });

    describe('personId', () => {
        it('should pass with numeric personId', async () => {
            const dto = plainToInstance(CreateVisitorDto, validPayload);
            const errors = await validate(dto);
            const pidErrors = errors.filter(e => e.property === 'personId');
            expect(pidErrors).toHaveLength(0);
        });

        it('should reject non-numeric personId', async () => {
            const dto = plainToInstance(CreateVisitorDto, { ...validPayload, personId: 'abc123' });
            const errors = await validate(dto);
            const pidErrors = errors.filter(e => e.property === 'personId');
            expect(pidErrors.length).toBeGreaterThan(0);
        });

        it('should reject personId with spaces', async () => {
            const dto = plainToInstance(CreateVisitorDto, { ...validPayload, personId: '123 456' });
            const errors = await validate(dto);
            const pidErrors = errors.filter(e => e.property === 'personId');
            expect(pidErrors.length).toBeGreaterThan(0);
        });
    });
});
