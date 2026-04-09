using System;

namespace ScannerService
{
    /// <summary>
    /// Thrown when the scanner hardware is detected as disconnected (USB removed).
    /// </summary>
    public class ScannerDisconnectedException : Exception
    {
        public ScannerDisconnectedException(string message) : base(message) { }
        public ScannerDisconnectedException(string message, Exception innerException)
            : base(message, innerException) { }
    }
}
