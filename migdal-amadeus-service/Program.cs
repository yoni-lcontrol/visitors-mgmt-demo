using Amadeus8.Configurations;
using Amadeus8.Data;
using Amadeus8.HostedServices;
using Amadeus8.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting.WindowsServices;
using Microsoft.Extensions.Logging.EventLog;

var builder = WebApplication.CreateBuilder(args);

// Windows Service hosting support (per docs/deployment-windows-service.md)
// UseWindowsService() is gated on IsWindowsService() so it only activates
// when running under the SCM. We also disable the EventLog provider that
// WebApplicationBuilder adds unconditionally on Windows (via HostApplicationBuilder)
// to avoid ObjectDisposedException during dotnet run when the event source
// is not registered on the developer machine.
if (WindowsServiceHelpers.IsWindowsService())
{
    builder.Host.UseWindowsService();
}
else if (OperatingSystem.IsWindows())
{
    // Disable EventLog: HostApplicationBuilder adds it on Windows regardless
    // of whether we are running as a service. Without a registered event source
    // every LogError call throws ObjectDisposedException and crashes the host.
    builder.Logging.AddFilter<EventLogLoggerProvider>(_ => false);
}

// Configuration - bind and validate Amadeus options (per docs/configuration.md)
builder.Services.AddOptions<AmadeusOptions>()
    .Bind(builder.Configuration.GetSection(AmadeusOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddOptions<BackendOptions>()
    .Bind(builder.Configuration.GetSection(BackendOptions.SectionName));

builder.Services.AddOptions<AmadeusImportSettings>()
    .Bind(builder.Configuration.GetSection(AmadeusImportSettings.SectionName));

// Database (per docs/database-guidelines.md)
builder.Services.AddDbContext<AmadeusDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// HttpClientFactory (per docs - prefer HttpClientFactory, reuse connections)
builder.Services.AddHttpClient("Amadeus");
builder.Services.AddHttpClient("Backend");

// Services (per docs/architecture-overview.md)
builder.Services.AddSingleton<IAmadeusAuthService, AmadeusAuthService>();
builder.Services.AddSingleton<IAmadeusSignalRClient, AmadeusSignalRClient>();
builder.Services.AddSingleton<IBackendApiClient, BackendApiClient>();
builder.Services.AddSingleton<IBackendEquipmentSnapshotProvider, BackendEquipmentSnapshotProvider>();
builder.Services.AddScoped<IAmadeusApiClient, AmadeusApiClient>();
builder.Services.AddScoped<IDeviceImportService, DeviceImportService>();
builder.Services.AddScoped<IAccessGroupImportService, AccessGroupImportService>();
builder.Services.AddScoped<ISecurityGroupImportService, SecurityGroupImportService>();
builder.Services.AddScoped<IAccessLevelImportService, AccessLevelImportService>();
builder.Services.AddScoped<IAccessImportRoutingService, AccessImportRoutingService>();
builder.Services.AddScoped<ICardholderSyncService, CardholderSyncService>();
builder.Services.AddScoped<ICardholderCommandService, CardholderCommandService>();
builder.Services.AddScoped<IEventProcessingService, EventProcessingService>();
builder.Services.AddScoped<IEquipmentResolverService, EquipmentResolverService>();
builder.Services.AddScoped<IAmadeusEventMappingService, AmadeusEventMappingService>();
builder.Services.AddScoped<IImportBridgeService, ImportBridgeService>();
builder.Services.AddScoped<IEquipmentStatusService, EquipmentStatusService>();

var enableHostedServices = builder.Configuration.GetValue(
    "Amadeus:EnableHostedServices",
    !builder.Environment.IsDevelopment());

// Hosted services (per docs/background-services.md)
if (enableHostedServices)
{
    builder.Services.AddSingleton<AmadeusFullSyncHostedService>();
    builder.Services.AddHostedService(sp => sp.GetRequiredService<AmadeusFullSyncHostedService>());
    builder.Services.AddHostedService<AmadeusEventListenerHostedService>();
    builder.Services.AddHostedService<BackendEquipmentStartupLoadHostedService>();
}

// API
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// Auto-create/migrate the SQLite database on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AmadeusDbContext>();
    db.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (!enableHostedServices)
{
    app.Logger.LogWarning("Amadeus hosted services are disabled by configuration");
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseAuthorization();
app.MapControllers();

app.Run();
