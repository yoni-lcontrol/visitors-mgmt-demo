/**
 * Standard UUID/GUID validation regex.
 * Used across DTOs for validating entity ID references.
 */
export const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
