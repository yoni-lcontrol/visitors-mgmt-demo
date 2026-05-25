using Amadeus8.Configurations;

namespace Amadeus8.Services;

public static class AmadeusApiDefinitions
{
    public static class OData
    {
        public const string Controllers = "/odata/API_Controllers";
        public const string Readers = "/odata/API_Readers";
        public const string Inputs = "/odata/API_Inputs";
        public const string Outputs = "/odata/API_Outputs";
        public const string SecurityGroups = "/odata/API_SecurityGroups";
        public const string AccessGroups = "/odata/API_AccessGroups";
        public const string Cardholders = "/odata/API_Cardholders";
        public const string CardholderPersonalDetails = "/odata/API_CardholderPersonalDetails";

        public static string CardholderPersonalDetailsByCardholderUid(string cardholderUid)
        {
            return $"{CardholderPersonalDetails}?$filter=uid eq {cardholderUid}";
        }

        public static string CardholderPersonalDetailsByUid(string uid)
        {
            return $"{CardholderPersonalDetails}({uid})";
        }

        public static string ControllersPaged(int skip, int top)
        {
            return BuildPagedPath(Controllers, skip, top);
        }

        public static string ReadersPaged(int skip, int top)
        {
            return BuildPagedPath(Readers, skip, top);
        }

        public static string InputsPaged(int skip, int top)
        {
            return BuildPagedPath(Inputs, skip, top);
        }

        public static string OutputsPaged(int skip, int top)
        {
            return BuildPagedPath(Outputs, skip, top);
        }

        public static string SecurityGroupsPaged(int skip, int top)
        {
            return BuildPagedPath(SecurityGroups, skip, top);
        }

        public static string AccessGroupsPaged(int skip, int top)
        {
            return BuildPagedPath(AccessGroups, skip, top);
        }

        public static string CardholdersPaged(int skip, int top)
        {
            return BuildPagedPath(Cardholders, skip, top);
        }

        public static string CardholderByUid(string uid)
        {
            return $"{Cardholders}({uid})";
        }

        public static string CardholdersByIdNumber(string cardholderIdNumber)
        {
            return $"{Cardholders}?$filter=cardholderIdNumber eq '{cardholderIdNumber}'";
        }

        private static string BuildPagedPath(string entitySetPath, int skip, int top)
        {
            return $"{entitySetPath}?$skip={skip}&$top={top}&$count=true";
        }
    }

    public static string TokenUrl(AmadeusOptions options)
    {
        return BuildAbsoluteUrl(options.BaseUrl, options.TokenEndpoint, nameof(options.TokenEndpoint));
    }

    public static string SignalRHubUrl(AmadeusOptions options)
    {
        return BuildAbsoluteUrl(options.BaseUrl, options.SignalRHubUrl, nameof(options.SignalRHubUrl));
    }

    public static string ODataUrl(AmadeusOptions options, string relativePath, string endpointName)
    {
        return BuildAbsoluteUrl(options.BaseUrl, relativePath, endpointName);
    }

    private static string BuildAbsoluteUrl(string baseUrl, string relativePath, string endpointName)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            throw new InvalidOperationException("Amadeus configuration 'BaseUrl' is not configured.");
        }

        if (string.IsNullOrWhiteSpace(relativePath))
        {
            throw new InvalidOperationException($"Amadeus endpoint '{endpointName}' is not configured.");
        }

        return baseUrl.TrimEnd('/') + "/" + relativePath.TrimStart('/');
    }
}