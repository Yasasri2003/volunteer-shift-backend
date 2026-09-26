// utils/validateEmail.js
//
// Three layers of checking, from cheapest to most thorough:
//   1. isValidEmail()      — syntax only (no network). Fast, catches typos
//                            like "notanemail" or "user@@mail.com".
//   2. isDisposableDomain() — blocklist of known fake/temp-mail providers.
//   3. domainCanReceiveMail() — an ACTUAL DNS lookup, confirming the domain
//                            has a mail server. Catches "asdf@asdf.com"
//                            style fake-but-well-formed addresses.
//
// IMPORTANT: step 3 needs a working DNS lookup. Some Windows machines have
// a misconfigured or flaky default DNS resolver (especially behind certain
// routers, VPNs, or campus networks), which can make even gmail.com appear
// to fail — not because the domain is invalid, but because the lookup
// itself couldn't complete. To guard against that:
//   - We query Google's and Cloudflare's public DNS servers directly
//     (8.8.8.8 / 1.1.1.1), instead of trusting whatever the OS has
//     configured, which fixes this for most people.
//   - We tell apart "the domain genuinely doesn't exist" (safe to reject)
//     from "the DNS lookup itself failed / timed out" (a local network
//     problem, not a fake-email problem) — in the second case we let
//     registration through rather than blocking everyone on a flaky
//     connection, and log a warning so it's visible in the server console.

const dns = require('dns');
const dnsPromises = dns.promises;

// Use reliable public resolvers instead of the OS default, which is the
// most common fix for "even real domains fail" on some Windows setups.
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

const EMAIL_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'temp-mail.org', 'guerrillamail.com',
  'guerrillamail.info', '10minutemail.com', 'yopmail.com', 'trashmail.com',
  'throwawaymail.com', 'fakeinbox.com', 'getnada.com', 'maildrop.cc',
  'mintemail.com', 'sharklasers.com', 'dispostable.com', 'mailnesia.com',
]);

// Error codes that mean "we asked, and the answer is genuinely no" —
// safe to treat as "this domain doesn't exist / has no mail server".
const DOMAIN_NOT_FOUND_CODES = new Set(['ENOTFOUND', 'ENODATA']);

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  if (trimmed.includes('..')) return false;
  return EMAIL_REGEX.test(trimmed);
}

function getDomain(email) {
  return email.trim().toLowerCase().split('@')[1];
}

function isDisposableDomain(email) {
  const domain = getDomain(email);
  return DISPOSABLE_DOMAINS.has(domain);
}

// Wraps a DNS call with a timeout, so a stuck network can't hang registration
// forever — after 5 seconds we treat it the same as an infrastructure failure.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('DNS lookup timed out'), { code: 'ETIMEOUT' })), ms)),
  ]);
}

// Returns one of: 'yes' (confirmed real), 'no' (confirmed doesn't exist),
// or 'unknown' (DNS itself failed — a local network problem, not the
// domain's fault).
async function checkDomainMailCapability(domain) {
  let mxFailedWithNotFound = false;

  try {
    const mxRecords = await withTimeout(dnsPromises.resolveMx(domain), 5000);
    if (mxRecords && mxRecords.length > 0) return 'yes';
  } catch (err) {
    if (DOMAIN_NOT_FOUND_CODES.has(err.code)) {
      mxFailedWithNotFound = true;
    } else {
      console.warn(`[email-check] MX lookup for "${domain}" failed with a network-level error (${err.code}) — this looks like a local DNS/network issue, not a fake domain.`);
      return 'unknown';
    }
  }

  try {
    const aRecords = await withTimeout(dnsPromises.resolve(domain), 5000);
    if (aRecords && aRecords.length > 0) return 'yes';
  } catch (err) {
    if (DOMAIN_NOT_FOUND_CODES.has(err.code)) {
      return mxFailedWithNotFound ? 'no' : 'unknown';
    }
    console.warn(`[email-check] A-record lookup for "${domain}" failed with a network-level error (${err.code}) — this looks like a local DNS/network issue, not a fake domain.`);
    return 'unknown';
  }

  return mxFailedWithNotFound ? 'no' : 'unknown';
}

async function domainCanReceiveMail(email) {
  const domain = getDomain(email);
  if (!domain) return false;
  const result = await checkDomainMailCapability(domain);
  return result !== 'no'; // 'yes' or 'unknown' both pass — see isRealEmail comment
}

// The single function the register endpoint should call.
async function isRealEmail(email) {
  if (!isValidEmail(email)) {
    return { valid: false, reason: 'Please enter a real, valid email address (e.g. name@example.com)' };
  }

  if (isDisposableDomain(email)) {
    return { valid: false, reason: 'Temporary/disposable email addresses are not allowed — please use your real email' };
  }

  const domain = getDomain(email);
  const result = await checkDomainMailCapability(domain);

  if (result === 'no') {
    return { valid: false, reason: "That email domain doesn't appear to exist or can't receive mail — please double check it" };
  }
  // 'unknown' means our DNS check itself couldn't run properly (a local
  // network issue) — we let it through rather than block every signup
  // because of that, but it's logged above so it's visible if it keeps happening.

  return { valid: true };
}

module.exports = { isValidEmail, isDisposableDomain, domainCanReceiveMail, isRealEmail };
