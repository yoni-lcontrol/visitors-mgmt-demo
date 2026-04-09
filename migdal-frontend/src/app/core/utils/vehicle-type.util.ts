import { TranslateService } from '@ngx-translate/core';
import { VehicleType } from '@core/models/entities.model';

export const VEHICLE_TYPE_TRANSLATION_KEYS: Record<string, string> = {
    [VehicleType.Private]: 'VISITORS.VEHICLE_TYPE_PRIVATE',
    [VehicleType.Company]: 'VISITORS.VEHICLE_TYPE_COMPANY',
    [VehicleType.Taxi]: 'VISITORS.VEHICLE_TYPE_TAXI',
    [VehicleType.Motorcycle]: 'VISITORS.VEHICLE_TYPE_MOTORCYCLE',
    [VehicleType.Truck]: 'VISITORS.VEHICLE_TYPE_TRUCK',
    [VehicleType.Other]: 'VISITORS.VEHICLE_TYPE_OTHER',
};

export function buildVehicleTypeOptions(translate: TranslateService): { label: string; value: string }[] {
    return Object.values(VehicleType).map(v => ({
        label: translate.instant(VEHICLE_TYPE_TRANSLATION_KEYS[v]),
        value: v,
    }));
}

export function getVehicleTypeLabel(type: string | null, translate: TranslateService): string {
    if (!type) return '-';
    const key = VEHICLE_TYPE_TRANSLATION_KEYS[type];
    return key ? translate.instant(key) : type;
}
