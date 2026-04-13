namespace Amadeus8.Configurations;

public class AmadeusImportSettings
{
    public const string SectionName = "AmadeusImport";

    // true  => import AccessLevels
    // false => import AccessGroups
    // null  => missing/invalid configuration
    public bool? ImportAccessLevels { get; set; }
}
