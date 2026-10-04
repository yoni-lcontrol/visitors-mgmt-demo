import * as fs from 'fs';
import * as https from 'https';
import { ConfigService } from '@nestjs/config';

/**
 * The Amadeus SOA gateway (ACCESS_CONTROL_REMOTE_URL) requires mutual TLS in
 * production. Without ACCESS_CONTROL_CLIENT_PFX_PATH configured, requests go
 * out with no client certificate and the gateway resets the connection.
 *
 * ACCESS_CONTROL_SERVER_CA_PATH trusts the gateway's own certificate (e.g. an
 * internal/self-signed CA). The file may contain a single certificate or the
 * full chain (leaf + intermediates) concatenated as multiple PEM blocks —
 * Node parses each block as a separate trusted CA.
 */
export function buildAccessControlHttpsAgent(configService: ConfigService): https.Agent {
    const pfxPath = configService.get<string>('ACCESS_CONTROL_CLIENT_PFX_PATH');
    const caPath = configService.get<string>('ACCESS_CONTROL_SERVER_CA_PATH');
    const ca = caPath ? fs.readFileSync(caPath) : undefined;

    if (!pfxPath) {
        return new https.Agent({ ca, rejectUnauthorized: true });
    }

    return new https.Agent({
        pfx: fs.readFileSync(pfxPath),
        passphrase: configService.get<string>('ACCESS_CONTROL_CLIENT_PFX_PASSPHRASE'),
        ca,
        rejectUnauthorized: true,
    });
}