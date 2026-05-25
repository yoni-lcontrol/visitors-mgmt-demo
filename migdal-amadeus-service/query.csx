using Microsoft.Data.Sqlite;
var conn = new SqliteConnection("Data Source=AmadeusIntegration_Dev.db");
conn.Open();
var cmd = conn.CreateCommand();
cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table'";
var r = cmd.ExecuteReader();
while(r.Read()) Console.WriteLine(r[0]);
r.Close();
cmd.CommandText = "SELECT * FROM AccessLevels";
r = cmd.ExecuteReader();
for(int i=0;i<r.FieldCount;i++) Console.Write(r.GetName(i) + " | ");
Console.WriteLine();
while(r.Read()) { for(int i=0;i<r.FieldCount;i++) Console.Write(r[i] + " | "); Console.WriteLine(); }
