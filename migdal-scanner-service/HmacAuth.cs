using System;
using System.Security.Cryptography;
using System.Text;

namespace ScannerService
{
    /// <summary>
    /// Generates HMAC-SHA256 signatures for agent registration,
    /// matching the backend's AgentHmacAuthService verification logic.
    /// Payload format: "{clientId}.{timestamp}"
    /// </summary>
    public static class HmacAuth
    {
        /// <summary>
        /// Compute HMAC-SHA256 signature for the agent:register handshake.
        /// </summary>
        /// <param name="clientId">Agent client ID.</param>
        /// <param name="timestampMs">Unix epoch milliseconds.</param>
        /// <param name="secret">HMAC shared secret.</param>
        /// <returns>Hex-encoded HMAC-SHA256 signature.</returns>
        public static string ComputeSignature(string clientId, long timestampMs, string secret)
        {
            var payload = $"{clientId}.{timestampMs}";
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
            {
                var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
                return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
            }
        }

        /// <summary>
        /// Get current Unix epoch timestamp in milliseconds.
        /// </summary>
        public static long GetTimestampMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }
}
