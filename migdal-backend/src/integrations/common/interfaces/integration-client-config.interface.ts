import { IntegrationProvider } from '../enums/integration-provider.enum';

export interface IntegrationClientConfig {
    clientId: string;
    provider: IntegrationProvider;
    secret: string;
    enabled: boolean;
}
