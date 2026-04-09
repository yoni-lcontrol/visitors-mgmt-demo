namespace ScannerService
{
    /// <summary>
    /// Provider types matching the backend IntegrationProvider enum.
    /// Used when registering or enrolling the agent.
    /// </summary>
    public static class ProviderType
    {
        public const string AccessControl = "access-control";
        public const string Scanner = "scanner";
        public const string Printer = "printer";
    }
}
