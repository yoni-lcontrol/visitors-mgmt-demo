import * as bcrypt from 'bcryptjs';
import { BCRYPT_SALT_ROUNDS } from '../constants/app.constants';

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function comparePassword(
    password: string,
    hash: string,
): Promise<boolean> {
    return bcrypt.compare(password, hash);
}
