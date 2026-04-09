using Serilog;
using System.ServiceProcess;

namespace ScannerService
{
    class Service : ServiceBase
    {
        public Service()
        {
            ServiceName = Program.ServiceName;
        }

        protected override void OnStart(string[] args)
        {
            Log.Information("Service is started");
            Program.Start(args);
        }

        protected override void OnStop()
        {
            Log.Information("Service is stopped");
            Program.Stop();
        }
    }
}
