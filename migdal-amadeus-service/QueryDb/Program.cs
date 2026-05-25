using System;
using Microsoft.Data.Sqlite;

var dbPath = @"C:\development\Migdal-new\migdal-app\migdal-amadeus-service\AmadeusIntegration_Dev.db";
using var conn = new SqliteConnection("Data Source=" + dbPath);
conn.Open();

Console.WriteLine("=== AccessGroups ===");
using (var cmd = conn.CreateCommand())
{
    cmd.CommandText = "SELECT Id, AmadeusUid, ApiKey, Name FROM AccessGroups";
    using var reader = cmd.ExecuteReader();
    while (reader.Read())
    {
        Console.WriteLine("Id=" + reader[0] + " | AmadeusUid=" + reader[1] + " | ApiKey=" + reader[2] + " | Name=" + reader[3]);
    }
}

Console.WriteLine("");
Console.WriteLine("=== AccessLevels ===");
using (var cmd2 = conn.CreateCommand())
{
    cmd2.CommandText = "SELECT Id, AmadeusUid, SourceType, ApiKey, Name, ExternalId FROM AccessLevels";
    using var reader2 = cmd2.ExecuteReader();
    while (reader2.Read())
    {
        Console.WriteLine("Id=" + reader2[0] + " | AmadeusUid=" + reader2[1] + " | SourceType=" + reader2[2] + " | ApiKey=" + reader2[3] + " | Name=" + reader2[4] + " | ExternalId=" + reader2[5]);
    }
}
