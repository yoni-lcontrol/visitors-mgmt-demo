import { SetMetadata } from '@nestjs/common';

export const IS_KIOSK_KEY = 'isKiosk';

/**
 * Decorator to mark a route as a kiosk endpoint (requires kiosk API key, skips JWT).
 * Usage: @KioskAuth()
 */
export const KioskAuth = () => SetMetadata(IS_KIOSK_KEY, true);
