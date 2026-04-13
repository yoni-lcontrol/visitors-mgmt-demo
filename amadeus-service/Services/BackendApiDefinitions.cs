namespace Amadeus8.Services;

public static class BackendApiDefinitions
{
    public static class Sync
    {
        public const string StartupFull = "/api/sync/full";
        public const string Controllers = "/api/sync/controllers";
        public const string Doors = "/api/sync/doors";
        public const string Extensions = "/api/sync/extensions";
        public const string AccessGroups = "/api/sync/access-groups";
        public const string SecurityGroups = "/api/sync/security-groups";
        public const string Cardholders = "/api/sync/cardholders";
    }

    public static class Resources
    {
        public const string Controllers = "/api/controllers";
        public const string Doors = "/api/doors";
        public const string DoorIos = "/api/door-ios";
        public const string Extensions = "/api/extensions";
        public const string ExtensionIos = "/api/extension-ios";
        public const string AccessGroups = "/api/access-groups";
        public const string SecurityGroups = "/api/security-groups";
        public const string Cardholders = "/api/cardholders";
        public const string Events = "/api/events";
        public const string AmadeusEventIngestion = "/api/events/amadeus";
    }

    public static string BuildUrl(string baseUrl, string relativePath, string endpointName)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            throw new InvalidOperationException("Backend base URL is not configured.");
        }

        if (string.IsNullOrWhiteSpace(relativePath))
        {
            throw new InvalidOperationException($"Backend endpoint '{endpointName}' is not configured.");
        }

        return baseUrl.TrimEnd('/') + "/" + relativePath.TrimStart('/');
    }
}