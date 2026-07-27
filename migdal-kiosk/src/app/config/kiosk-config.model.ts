export interface KioskConfig {
    KIOSK_ID: string;
    WORKSTATION_CODE: string;
    HOME_URL: string;
    ERROR_URL: string;
    IDLE_TIMEOUT_MS: number;
    ENABLE_RELOAD_ON_IDLE: boolean;
    RELOAD_AFTER_IDLE_MS: number;
    APP_VERSION: string;
    API_BASE_URL: string;
    /** Sent as the x-kiosk-api-key header on REST calls to the backend. */
    WS_API_KEY: string;
    /** Hostname/IP of the paired scanner machine on the local network. */
    SCANNER_HOST: string;
    /** Port the scanner's local WebSocket server listens on. */
    SCANNER_PORT: number;
    /** Shared secret sent in the hello handshake; must match the scanner's LocalServerToken. */
    SCANNER_TOKEN: string;
    /** Hostname/IP of the paired printer machine on the local network. */
    PRINTER_HOST: string;
    /** Port the printer's local WebSocket server listens on. */
    PRINTER_PORT: number;
    /** Shared secret sent in the hello handshake; must match the printer's LocalServerToken. */
    PRINTER_TOKEN: string;
    HEARTBEAT_INTERVAL_MS: number;
    /** Per-workstation overrides (e.g. SCANNER_TOKEN/PRINTER_TOKEN), keyed by WORKSTATION_CODE. */
    STATION_OVERRIDES?: Record<string, Partial<KioskConfig>>;
}