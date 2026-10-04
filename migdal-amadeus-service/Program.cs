using Amadeus8.Configurations;
using Amadeus8.Data;
using Amadeus8.HostedServices;
using Amadeus8.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting.WindowsServices;
using Microsoft.Extensions.Logging.EventLog;
using Microsoft.Extensions.Options;
using System.Security.Cryptography.X509Certificates;

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

builder.Services.AddOptions<ClientCertificateOptions>()
    .Bind(builder.Configuration.GetSection(ClientCertificateOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddOptions<AmadeusImportSettings>()
    .Bind(builder.Configuration.GetSection(AmadeusImportSettings.SectionName));

// Database (per docs/database-guidelines.md)
builder.Services.AddDbContext<AmadeusDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// HttpClientFactory (per docs - prefer HttpClientFactory, reuse connections)
// Timeouts prevent thread-pool starvation when the remote host is unreachable.
builder.Services.AddHttpClient("Amadeus", client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
})
.ConfigurePrimaryHttpMessageHandler(sp =>
{
    var options = sp.GetRequiredService<IOptions<AmadeusOptions>>().Value;
    var clientCertificateOptions = sp.GetRequiredService<IOptions<ClientCertificateOptions>>().Value;
    var clientCertificate = X509CertificateLoader.LoadPkcs12FromFile(clientCertificateOptions.Path, clientCertificateOptions.Password);
    var serverCertificate = X509CertificateLoader.LoadPkcs12FromFile(options.ServerCertificatePath, options.ServerCertificatePassword);
    var handler = new HttpClientHandler
    {
        ClientCertificateOptions = ClientCertificateOption.Manual,
        // The Amadeus gateway presents a certificate from a private/internal CA that
        // isn't in the OS trust store, so we pin the expected server certificate by
        // thumbprint instead of relying on chain-of-trust validation.
        ServerCertificateCustomValidationCallback = (_, presentedCertificate, _, _) =>
            presentedCertificate is not null && presentedCertificate.GetCertHash().AsSpan().SequenceEqual(serverCertificate.GetCertHash())
    };
    handler.ClientCertificates.Add(clientCertificate);
    return handler;
});
builder.Services.AddHttpClient("Backend", client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
})
.ConfigurePrimaryHttpMessageHandler(sp =>
{
    var options = sp.GetRequiredService<IOptions<BackendOptions>>().Value;
    var clientCertificateOptions = sp.GetRequiredService<IOptions<ClientCertificateOptions>>().Value;
    var handler = new HttpClientHandler
    {
        // The ESB/SOA gateway is a legacy Java stack that resets the connection when a
        // client certificate is requested over TLS 1.3 (post-handshake client auth isn't
        // handled correctly) - pin to TLS 1.2, which it negotiates mutual TLS over fine.
        SslProtocols = System.Security.Authentication.SslProtocols.Tls12
    };

    // The ESB/SOA gateway requires mutual TLS; without a client certificate it
    // resets the connection mid-handshake instead of returning an HTTP error.
    // Local/dev backends run over plain HTTP, so this is only wired up when configured.
    if (!string.IsNullOrEmpty(clientCertificateOptions.Path))
    {
        var clientCertificate = X509CertificateLoader.LoadPkcs12FromFile(
            clientCertificateOptions.Path, clientCertificateOptions.Password);
        handler.ClientCertificateOptions = ClientCertificateOption.Manual;
        handler.ClientCertificates.Add(clientCertificate);
    }

    // The gateway presents a certificate from a private/internal CA that isn't in
    // the OS trust store, so we pin the expected server certificate by thumbprint
    // instead of relying on chain-of-trust validation (same approach as Amadeus).
    if (!string.IsNullOrEmpty(options.ServerCertificatePath))
    {
        var serverCertificate = X509CertificateLoader.LoadPkcs12FromFile(
            options.ServerCertificatePath, options.ServerCertificatePassword);
        handler.ServerCertificateCustomValidationCallback = (_, presentedCertificate, _, _) =>
            presentedCertificate is not null && presentedCertificate.GetCertHash().AsSpan().SequenceEqual(serverCertificate.GetCertHash());
    }
    else
    {
        // No server certificate configured to pin against - skip validation entirely
        // (the ESB gateway's certificate does not pass normal chain/hostname validation).
        handler.ServerCertificateCustomValidationCallback = (_, _, _, _) => true;
    }

    return handler;
});

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
builder.Services.AddScoped<ICardSyncService, CardSyncService>();
builder.Services.AddScoped<ICardholderCommandService, CardholderCommandService>();
builder.Services.AddScoped<IEventProcessingService, EventProcessingService>();
builder.Services.AddScoped<IEquipmentResolverService, EquipmentResolverService>();
builder.Services.AddScoped<IAmadeusEventMappingService, AmadeusEventMappingService>();
builder.Services.AddScoped<IImportBridgeService, ImportBridgeService>();
builder.Services.AddSingleton<IImportJobManager, ImportJobManager>();
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

// Log every inbound HTTP request (success, failure, or unmatched route) — registered
// first so it wraps the whole pipeline, including requests that don't match any controller.
var requestLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("InboundRequest");
app.Use(async (context, next) =>
{
    var method = context.Request.Method;
    var path = $"{context.Request.Path}{context.Request.QueryString}";
    var stopwatch = System.Diagnostics.Stopwatch.StartNew();

    try
    {
        await next();
    }
    catch (Exception ex)
    {
        stopwatch.Stop();
        requestLogger.LogError(ex, "{Method} {Path} -> unhandled exception ({ElapsedMs}ms)", method, path, stopwatch.ElapsedMilliseconds);
        throw;
    }

    stopwatch.Stop();
    var statusCode = context.Response.StatusCode;
    var message = $"{method} {path} -> {statusCode} ({stopwatch.ElapsedMilliseconds}ms)";

    if (statusCode >= 500)
    {
        requestLogger.LogError(message);
    }
    else if (statusCode >= 400)
    {
        requestLogger.LogWarning(message);
    }
    else
    {
        requestLogger.LogInformation(message);
    }
});

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
