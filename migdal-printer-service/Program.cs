using PrinterService;
using Serilog;
using Serilog.Events;

// --------------------- Serilog ---------------------
var logDir = Path.Combine(AppContext.BaseDirectory, "Logs");
Directory.CreateDirectory(logDir);

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("System", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Application", "PrinterService")
    .WriteTo.Console()
    .WriteTo.File(
        Path.Combine(logDir, "printer-service-.log"),
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 14,
        rollOnFileSizeLimit: true,
        fileSizeLimitBytes: 10485760,
        shared: true,
        outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .WriteTo.File(
        Path.Combine(logDir, "errors-.log"),
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        restrictedToMinimumLevel: LogEventLevel.Error,
        shared: true,
        outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .CreateLogger();

try
{
    Log.Information("Starting PrinterService");

    var host = Host.CreateDefaultBuilder(args)
        .UseWindowsService()
        .UseSerilog()
        .ConfigureServices((context, services) =>
        {
            // Agent configuration (reads from appsettings.json "Agent" section + persisted credentials)
            services.AddSingleton(sp => AgentConfig.Load(context.Configuration));

            // Printer SDK manager (singleton + hosted service for SDK lifecycle)
            services.AddSingleton<PrinterManager>();
            services.AddHostedService(sp => sp.GetRequiredService<PrinterManager>());

            // Agent socket client (connects to backend /ws/agents, handles commands)
            services.AddHostedService<AgentSocketClient>();
        })
        .Build();

    await host.RunAsync();
}
catch (OperationCanceledException)
{
    // Normal shutdown via Ctrl+C
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
