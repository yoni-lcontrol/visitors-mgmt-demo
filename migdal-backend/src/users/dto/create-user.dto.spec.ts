import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
    const validPayload = {
        username: 'john.doe',
        password: 'SecurePass@123',
        firstName: 'John',
        lastName: 'Doe',
    };

    it('should pass with valid email', async () => {
        const dto = plainToInstance(CreateUserDto, { ...validPayload, email: 'john@example.com' });
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors).toHaveLength(0);
    });

    it('should pass when email is omitted', async () => {
        const dto = plainToInstance(CreateUserDto, validPayload);
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors).toHaveLength(0);
    });

    it('should pass when email is empty string (transformed to undefined)', async () => {
        const dto = plainToInstance(CreateUserDto, { ...validPayload, email: '' });
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors).toHaveLength(0);
    });

    it('should pass when email is null', async () => {
        const dto = plainToInstance(CreateUserDto, { ...validPayload, email: null });
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors).toHaveLength(0);
    });

    it('should reject invalid email format', async () => {
        const dto = plainToInstance(CreateUserDto, { ...validPayload, email: 'not-an-email' });
        const errors = await validate(dto);
        const emailErrors = errors.filter(e => e.property === 'email');
        expect(emailErrors.length).toBeGreaterThan(0);
    });

    it('should reject missing required fields', async () => {
        const dto = plainToInstance(CreateUserDto, {});
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        const fields = errors.map(e => e.property);
        expect(fields).toContain('username');
        expect(fields).toContain('firstName');
        expect(fields).toContain('lastName');
    });

    it('should pass when password is omitted', async () => {
        const { password, ...noPassword } = validPayload;
        const dto = plainToInstance(CreateUserDto, noPassword);
        const errors = await validate(dto);
        const passwordErrors = errors.filter(e => e.property === 'password');
        expect(passwordErrors).toHaveLength(0);
    });

    it('should reject password shorter than 8 characters', async () => {
        const dto = plainToInstance(CreateUserDto, { ...validPayload, password: 'short' });
        const errors = await validate(dto);
        const passwordErrors = errors.filter(e => e.property === 'password');
        expect(passwordErrors.length).toBeGreaterThan(0);
    });
});
