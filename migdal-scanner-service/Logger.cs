using Serilog;
using System;

namespace ScannerService
{
    public static class Logger
    {
        public static void ConfigureLogger()
        {
            string path = AppDomain.CurrentDomain.BaseDirectory;

            Log.Logger = new LoggerConfiguration()
                            .MinimumLevel.Debug()
                            .WriteTo.Console()
                            .WriteTo.File(path + "\\Logs\\MyService.log",
                                fileSizeLimitBytes: 1000000, // 1 MB
                                rollingInterval: RollingInterval.Day,
                                retainedFileCountLimit: 10)
                            .CreateLogger();
        }
    }
}
