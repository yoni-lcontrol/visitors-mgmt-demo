using System.Security.Cryptography;
using System.Text;

namespace PrinterService;

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
    public static string ComputeSignature(string clientId, long timestampMs, string secret)
    {
        var payload = $"{clientId}.{timestampMs}";
        var key = Encoding.UTF8.GetBytes(secret);
        var data = Encoding.UTF8.GetBytes(payload);
        var hash = HMACSHA256.HashData(key, data);
        return Convert.ToHexStringLower(hash);
    }

    /// <summary>
    /// Get current Unix epoch timestamp in milliseconds.
    /// </summary>
    public static long GetTimestampMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
}
