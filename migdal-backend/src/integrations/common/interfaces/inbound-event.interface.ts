import { IntegrationProvider } from '../enums/integration-provider.enum';

/**
 * Canonical internal event structure.
 * Every provider adapter maps its external DTO into this shape.
 */
export interface InboundEvent {
    provider: IntegrationProvider;
    externalEventId: string;
    eventType: string;
    occurredAt: Date;
    sourceEntityId: string | null;
    payload: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
}
