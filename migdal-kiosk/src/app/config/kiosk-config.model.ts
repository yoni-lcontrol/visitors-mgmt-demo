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
    WS_URL: string;
    WS_API_KEY: string;
    HEARTBEAT_INTERVAL_MS: number;
}