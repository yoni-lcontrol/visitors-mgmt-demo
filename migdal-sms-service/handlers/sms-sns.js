require("dotenv").config();
const axios = require("axios");
const log = require('../global-functions/console');

const base = (process.env.SNS_BASE_URL || "").replace(/\/+$/, "");
const url = `${base}/Server/API/clientSendMsg`;
const sender = process.env.SNS_SENDER;
const https = require('https');

function buildHttpsAgent() {
    try {
        let caPem = null;

        // Option A: read PEM from path
        const pemPath = (process.env.SNS_CA_PEM_PATH || "").trim();
        if (pemPath) {
            const abs = path.isAbsolute(pemPath) ? pemPath : path.join(process.cwd(), pemPath);
            caPem = fs.readFileSync(abs, "utf8");
            if (!caPem || !caPem.includes("BEGIN CERTIFICATE")) {
                throw new Error(`PEM file does not look like a certificate: ${abs}`);
            }

            log.info(`TLS: Using CA PEM from file: ${abs}`);
            return new https.Agent({ ca: caPem, rejectUnauthorized: true });
        }

        // Option B: read PEM from base64 env var (useful for servers/containers)
        const pemB64 = (process.env.SNS_CA_PEM_BASE64 || "").trim();
        if (pemB64) {
            caPem = Buffer.from(pemB64, "base64").toString("utf8");
            if (!caPem || !caPem.includes("BEGIN CERTIFICATE")) {
                throw new Error("SNS_CA_PEM_BASE64 does not decode to a valid PEM certificate");
            }

            log.info("TLS: Using CA PEM from SNS_CA_PEM_BASE64");
            return new https.Agent({ ca: caPem, rejectUnauthorized: true });
        }

        // No PEM configured -> fallback
        log.alert("TLS: No PEM configured (SNS_CA_PEM_PATH / SNS_CA_PEM_BASE64). Falling back to rejectUnauthorized:false");
        return new https.Agent({ rejectUnauthorized: false });
    } catch (err) {
        // Any error reading/validating PEM -> fallback
        log.alert(`TLS: Failed to use PEM CA (${err.message}). Falling back to rejectUnauthorized:false`);
        return new https.Agent({ rejectUnauthorized: false });
    }
}

const httpsAgent = buildHttpsAgent();

async function sendSmsWithSNS({ phoneTo, text }) {
  const built = buildSnsTo(phoneTo);
  if (!built.ok) {
    log.error(`Invalid phone: "${phoneTo}" reason=${built.reason}`);
    return { status: 500, info: `invalid phone: ${built.reason}` };
  }

  const to = built.to;

  // log BEFORE sending (to catch changes)
  log.info(`SMS send requested. raw="${phoneTo}" -> to="${to}" normalized=${JSON.stringify(built.normalized)}`);

  const body = new URLSearchParams({
    uid: process.env.SNS_UID,
    pass: process.env.SNS_PASS,
    msg: text,
    to,
    sender: sender
  });

  const res = await axios.post(url, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 30000,
    validateStatus: () => true,
    proxy: false,
    httpsAgent
  });

  // log AFTER
  log.info(`SNS++ HTTP=${res.status} data=${typeof res.data === "string" ? res.data : JSON.stringify(res.data)}`);

  // check SNS++ body schema: {status:200,...}
  const data = (typeof res.data === "string") ? safeJsonParse(res.data) : res.data;

  if (!data || data.status !== 200) {
    log.error(`SNS++ send failed. to="${to}" raw="${phoneTo}" http=${res.status} snsStatus=${data?.status} info=${data?.info}`);
  }

  return data;
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function normalizePhone(raw) {
  if (!raw) return { ok: false, reason: "phone is empty" };

  // remove spaces, dashes, parentheses
  let s = String(raw).trim().replace(/[^\d+]/g, "");

  // allow leading +
  if (s.startsWith("+")) s = s.slice(1);

  // now digits only
  if (!/^\d+$/.test(s)) return { ok: false, reason: "phone contains invalid chars" };

  // cases:
  // 1) Israeli local: 05XXXXXXXX (10 digits)
  if (s.startsWith("05")) {
    if (s.length !== 10) return { ok: false, reason: "IL local must be 10 digits and start with 05" };
    return { ok: true, isIsraeli: true, e164: "972" + s.slice(1), local: s };
  }

  // 2) Israeli with country code: 9725XXXXXXXX (12 digits usually)
  if (s.startsWith("972")) {
    // basic sanity: should be 9725 + 8 digits => 12 digits total
    if (s.length < 11 || s.length > 15) return { ok: false, reason: "E164 length is invalid" };
    // if it is mobile, usually 9725...
    return { ok: true, isIsraeli: s.startsWith("9725"), e164: s, local: s.startsWith("9725") ? ("0" + s.slice(3)) : null };
  }

  // 3) International E164-ish: countrycode + number (no leading 0 assumptions)
  if (s.length < 8 || s.length > 15) return { ok: false, reason: "International length must be 8-15 digits" };
  return { ok: true, isIsraeli: false, e164: s, local: null };
}

function buildSnsTo(rawPhone) {
  const p = normalizePhone(rawPhone);
  if (!p.ok) return { ok: false, reason: p.reason };

  // Your system expects "online:*"
  // Israeli: online:*05XXXXXXXXX (local) OR you can use e164, but you asked local
  if (p.isIsraeli && p.local) {
    return { ok: true, to: `online:*${p.local}`, normalized: p };
  }

  // International: online:*<countrycode+number>
  return { ok: true, to: `online:*${p.e164}`, normalized: p };
}

module.exports.sendSmsWithSNS = sendSmsWithSNS;