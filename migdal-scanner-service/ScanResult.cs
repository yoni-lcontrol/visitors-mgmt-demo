namespace ScannerService
{
    public class ScanResult
    {
        public bool error { get; set; } = false;
        public string personId { get; set; } = string.Empty;
        public string firstName { get; set; } = string.Empty;
        public string lastName { get; set; } = string.Empty;
        public string image { get; set; } = string.Empty;
        public string identifyNumber { get; set; } = string.Empty;


    }
}
