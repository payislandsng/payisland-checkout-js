"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  close: () => close,
  default: () => index_default,
  open: () => open
});
module.exports = __toCommonJS(index_exports);

// src/utils.ts
var PRODUCTION_API_BASE = "https://ags.payislands.com";
var TERMINAL_SUCCESS = /* @__PURE__ */ new Set(["paid", "successful", "success"]);
var TERMINAL_FAILURE = /* @__PURE__ */ new Set([
  "failed",
  "canceled",
  "cancelled",
  "reversed"
]);
var EXPIRED = /* @__PURE__ */ new Set(["expired"]);
var PENDING = /* @__PURE__ */ new Set(["pending", "unpaid", "processing", "initiated"]);
var CheckoutError = class extends Error {
  constructor(payload) {
    super(payload.message);
    this.name = "CheckoutError";
    this.code = payload.code;
    this.status = payload.status;
    this.requestId = payload.requestId;
  }
  toPayload() {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      requestId: this.requestId
    };
  }
};
function validateReference(reference) {
  if (typeof reference !== "string" || reference.trim().length < 6) {
    throw new CheckoutError({
      code: "invalid_reference",
      message: "Enter a valid PayIsland transaction reference."
    });
  }
  const normalized = reference.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new CheckoutError({
      code: "invalid_reference",
      message: "The PayIsland transaction reference contains unsupported characters."
    });
  }
  return normalized;
}
function resolveApiBaseUrl(override) {
  if (!override) return PRODUCTION_API_BASE;
  const currentHost = window.location.hostname;
  const allowedHost = ["localhost", "127.0.0.1", "::1"].includes(currentHost);
  if (!allowedHost) {
    throw new CheckoutError({
      code: "api_base_not_allowed",
      message: "API base overrides are only available for local development and testing."
    });
  }
  return override.replace(/\/+$/, "");
}
function getRequestId(headers) {
  return headers.get("x-request-id") ?? headers.get("x-correlation-id") ?? headers.get("x-trace-id") ?? void 0;
}
function normalizeStatus(raw) {
  const status = String(raw ?? "").trim().toLowerCase();
  if (TERMINAL_SUCCESS.has(status)) return "success";
  if (EXPIRED.has(status)) return "expired";
  if (TERMINAL_FAILURE.has(status)) return "failed";
  if (PENDING.has(status)) return "pending";
  return "unknown";
}
function extractTransaction(payload) {
  if (!payload) return {};
  const maybeData = "data" in payload ? payload.data : void 0;
  const maybeTransaction = "transaction" in payload ? payload.transaction : void 0;
  return maybeTransaction ?? maybeData ?? payload;
}
function extractStatus(payload) {
  const transaction = extractTransaction(payload);
  return payload?.status ?? transaction.status;
}
function extractChannels(payload) {
  const transaction = extractTransaction(payload);
  const candidates = payload?.channels ?? payload?.payment_channels ?? payload?.available_channels ?? transaction.channels;
  if (Array.isArray(candidates) && candidates.length > 0) {
    return candidates.filter(
      (channel) => typeof channel === "string"
    );
  }
  const channels = [];
  if (extractBankTransfer(payload)) channels.push("bank-transfer");
  if (extractAuthorizationUrl(payload)) channels.push("redirect");
  return channels.length > 0 ? channels : ["bank-transfer", "redirect", "card"];
}
function extractMerchant(payload) {
  const transaction = extractTransaction(payload);
  return payload?.merchant ?? transaction.merchant ?? {};
}
function extractCustomer(payload) {
  const transaction = extractTransaction(payload);
  return payload?.customer ?? transaction.customer ?? {};
}
function extractBankTransfer(payload) {
  return payload?.bank_transfer ?? payload?.bankTransfer;
}
function extractAuthorizationUrl(payload) {
  return payload?.authorization_url ?? payload?.authorizationUrl;
}
function getPollDelay(payload, fallback = 5e3) {
  const retryAfter = payload?.retry_after_ms;
  const pollInterval = payload?.poll_interval_ms;
  const value = typeof retryAfter === "number" ? retryAfter : pollInterval;
  if (!value || value < 1e3) return fallback;
  return Math.min(value, 6e4);
}
function formatMoney(amount, currency = "NGN") {
  if (amount === void 0 || amount === null || amount === "") return "--";
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format(value);
}
function maskEmail(email) {
  if (!email) return "";
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(name.length - 2, 2))}@${domain}`;
}
function customerDisplayName(customer) {
  const name = customer.name ?? [customer.first_name, customer.last_name].filter(Boolean).join(" ");
  return name.trim();
}
function merchantDisplayName(merchant, fallback) {
  return merchant.business_name ?? merchant.name ?? fallback ?? "PayIsland merchant";
}
function safeUrl(value) {
  if (!value) return void 0;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.toString();
    if (url.protocol === "http:" && isLocalHost(url.hostname))
      return url.toString();
  } catch {
    return void 0;
  }
  return void 0;
}
function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
function friendlyApiError(status, requestId) {
  if (status === 404) {
    return new CheckoutError({
      code: "reference_not_found",
      message: "This checkout link is invalid or has expired.",
      status,
      requestId
    });
  }
  if (status >= 400 && status < 500) {
    return new CheckoutError({
      code: "validation_error",
      message: "We could not continue with this checkout. Please confirm the payment details.",
      status,
      requestId
    });
  }
  return new CheckoutError({
    code: "network_error",
    message: "We could not reach PayIsland. Please check your connection and try again.",
    status,
    requestId
  });
}

// src/api-client.ts
var ApiClient = class {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  setCheckoutToken(token) {
    this.checkoutToken = token;
  }
  async bootstrap(reference) {
    return this.request(
      `/api/v1/transactions/gateway/pay/keys/${reference}`,
      {
        method: "GET"
      }
    );
  }
  async submitPayment(reference, body) {
    return this.request(
      `/api/v1/transactions/gateway/pay/${reference}`,
      {
        method: "POST",
        body: JSON.stringify(body)
      }
    );
  }
  async verifyOtp(reference, body) {
    return this.request(
      `/api/v1/transactions/gateway/otp/verify/${reference}`,
      {
        method: "POST",
        body: JSON.stringify(body)
      }
    );
  }
  async verify(reference) {
    return this.request(
      `/api/v1/transactions/gateway/transaction/verify/${reference}`,
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );
  }
  async verifyBankTransfer(reference) {
    return this.request(
      `/api/v1/transactions/gateway/transaction/verify-bank-transfer/${reference}`,
      { method: "GET" }
    );
  }
  async request(path, init) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          ...init.method !== "GET" ? { "Content-Type": "application/json" } : {},
          ...this.checkoutToken ? { "x-checkout-token": this.checkoutToken } : {},
          ...init.headers
        },
        credentials: "omit"
      });
    } catch {
      throw new CheckoutError({
        code: "network_error",
        message: "We could not reach PayIsland. Please check your connection and try again."
      });
    }
    const requestId = getRequestId(response.headers);
    if (!response.ok) {
      throw friendlyApiError(response.status, requestId);
    }
    return {
      data: await parseJson(response) ?? {},
      checkoutToken: response.headers.get("x-checkout-token") ?? void 0,
      requestId
    };
  }
};
async function parseJson(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return void 0;
  return await response.json();
}

// src/channels/bank-transfer.ts
function getBankTransferFields(details) {
  const accountNumber = details?.account_number ?? details?.accountNumber;
  if (!accountNumber) return null;
  return {
    accountNumber,
    accountName: details?.account_name ?? details?.accountName ?? "PayIsland checkout",
    bankName: details?.bank_name ?? details?.bankName ?? "Bank transfer",
    expiresAt: details?.expires_at ?? details?.expiresAt
  };
}

// src/channels/card-placeholder.ts
function cardUnavailableMessage() {
  return "Card payments are not available in this checkout yet.";
}

// src/channels/redirect.ts
function openRedirect(url) {
  const target = safeUrl(url);
  if (!target) return false;
  window.open(target, "_blank", "noopener,noreferrer");
  return true;
}

// src/assets/payisland-logo-dark.png
var payisland_logo_dark_default = "data:image/png;base64,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";

// src/assets/payisland-logo-light.png
var payisland_logo_light_default = "data:image/png;base64,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";

// src/styles.ts
var styles = `
:host {
  all: initial;
  --pi-primary: #074761;
  --pi-primary-strong: #05364a;
  --pi-primary-soft: #e7f2f6;
  --pi-accent: #8aa0ad;
  --pi-text: #111827;
  --pi-muted: #607080;
  --pi-border: #d8e1e8;
  --pi-border-strong: #b9c7d1;
  --pi-surface: #ffffff;
  --pi-soft: #f6f9fb;
  --pi-raised: #fbfdfe;
  --pi-danger: #b42318;
  --pi-danger-soft: #fff1f0;
  --pi-success: #067647;
  --pi-success-soft: #e8f8ef;
  --pi-warning: #9a6700;
  --pi-warning-soft: #fff7df;
  --pi-focus: rgba(7, 71, 97, 0.28);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* {
  box-sizing: border-box;
}
button,
input {
  font: inherit;
}
button {
  -webkit-tap-highlight-color: transparent;
}
button:focus-visible {
  outline: 3px solid var(--pi-focus);
  outline-offset: 2px;
}
.pi-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(10, 20, 30, 0.58);
  backdrop-filter: blur(4px);
}
.pi-inline {
  width: 100%;
}
.pi-modal {
  width: min(100%, 480px);
  max-height: min(780px, calc(100vh - 40px));
  overflow: hidden;
  border: 1px solid rgba(216, 225, 232, 0.92);
  border-radius: 14px;
  background: var(--pi-surface);
  color: var(--pi-text);
  box-shadow: 0 28px 90px rgba(8, 18, 28, 0.28);
}
.pi-inline .pi-modal {
  max-height: none;
  box-shadow: 0 10px 32px rgba(8, 18, 28, 0.08);
}
.pi-header,
.pi-body,
.pi-footer {
  padding: 16px 18px;
}
.pi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--pi-border);
  background: linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%);
}
.pi-header-main,
.pi-brand {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
}
.pi-logo-frame {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--pi-border);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 18px rgba(7, 71, 97, 0.08);
}
.pi-logo,
.pi-logo-fallback {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  object-fit: contain;
}
.pi-logo-fallback {
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--pi-primary);
  color: #fff;
  font-weight: 800;
}
.pi-heading {
  min-width: 0;
}
.pi-eyebrow,
.pi-label {
  display: block;
  margin: 0 0 3px;
  color: var(--pi-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.2;
  text-transform: uppercase;
}
.pi-title {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--pi-text);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.25;
}
.pi-subtitle {
  margin: 4px 0 0;
  color: var(--pi-muted);
  font-size: 13px;
  line-height: 1.35;
}
.pi-close {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--pi-muted);
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
}
.pi-close:hover,
.pi-close:focus-visible {
  border-color: var(--pi-border);
  background: #fff;
  color: var(--pi-text);
}
.pi-body {
  max-height: calc(100vh - 178px);
  overflow-y: auto;
  background: var(--pi-surface);
}
.pi-inline .pi-body {
  max-height: none;
}
.pi-stack {
  display: grid;
  gap: 16px;
}
.pi-summary {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--pi-border);
  border-radius: 12px;
  background: var(--pi-raised);
}
.pi-summary-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border-bottom: 1px solid var(--pi-border);
  background: linear-gradient(135deg, var(--pi-primary-soft), #ffffff 70%);
}
.pi-summary-hero strong {
  display: block;
  color: var(--pi-primary-strong);
  font-size: 26px;
  font-weight: 850;
  line-height: 1.05;
}
.pi-summary-hero p {
  max-width: 42%;
  margin: 0;
  color: var(--pi-muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  text-align: right;
}
.pi-summary-grid {
  display: grid;
  gap: 0;
  padding: 4px 14px;
}
.pi-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 34px;
  border-bottom: 1px solid rgba(216, 225, 232, 0.72);
  color: var(--pi-muted);
  font-size: 14px;
}
.pi-row:last-child {
  border-bottom: 0;
}
.pi-row strong {
  min-width: 0;
  color: var(--pi-text);
  font-weight: 750;
  overflow-wrap: anywhere;
  text-align: right;
}
.pi-reference strong {
  color: var(--pi-muted);
  font-size: 12px;
  font-weight: 700;
}
.pi-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(124px, 1fr));
  gap: 6px;
  padding: 5px;
  border: 1px solid var(--pi-border);
  border-radius: 12px;
  background: var(--pi-soft);
}
.pi-tab {
  min-height: 40px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--pi-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
}
.pi-tab:hover:not([disabled]) {
  color: var(--pi-text);
  background: #fff;
}
.pi-tab[aria-selected="true"] {
  border-color: rgba(7, 71, 97, 0.18);
  background: var(--pi-primary);
  color: #fff;
  box-shadow: 0 8px 18px rgba(7, 71, 97, 0.18);
}
.pi-tab[disabled] {
  cursor: not-allowed;
  opacity: 0.48;
}
.pi-panel {
  display: grid;
  gap: 12px;
}
.pi-panel-title,
.pi-state-title {
  margin: 0;
  color: var(--pi-text);
  font-size: 16px;
  font-weight: 850;
  line-height: 1.25;
}
.pi-bank-box {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--pi-border);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(8, 18, 28, 0.05);
}
.pi-bank-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.pi-bank-intro strong {
  color: var(--pi-primary-strong);
  font-size: 14px;
  font-weight: 850;
  text-align: right;
}
.pi-account {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(7, 71, 97, 0.16);
  border-radius: 12px;
  background: linear-gradient(180deg, var(--pi-primary-soft), #fff);
}
.pi-account > span {
  color: var(--pi-muted);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.pi-account-number {
  color: var(--pi-primary-strong);
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.1;
  overflow-wrap: anywhere;
}
.pi-bank-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.pi-detail {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--pi-border);
  border-radius: 10px;
  background: var(--pi-soft);
}
.pi-detail span {
  color: var(--pi-muted);
  font-size: 12px;
  font-weight: 750;
}
.pi-detail strong {
  min-width: 0;
  color: var(--pi-text);
  font-size: 14px;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.pi-copy,
.pi-primary,
.pi-secondary {
  min-height: 42px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
}
.pi-copy {
  justify-self: start;
  border: 1px solid var(--pi-primary);
  background: #fff;
  color: var(--pi-primary);
  padding: 0 14px;
}
.pi-copy:hover,
.pi-secondary:hover {
  border-color: var(--pi-border-strong);
  background: var(--pi-soft);
}
.pi-primary {
  width: 100%;
  border: 0;
  background: var(--pi-primary);
  color: #fff;
  box-shadow: 0 10px 18px rgba(7, 71, 97, 0.18);
}
.pi-primary:hover,
.pi-primary:focus-visible {
  background: var(--pi-primary-strong);
}
.pi-primary:disabled,
.pi-secondary:disabled {
  cursor: not-allowed;
  opacity: 0.62;
  box-shadow: none;
}
.pi-secondary {
  border: 1px solid var(--pi-border);
  background: #fff;
  color: var(--pi-text);
  padding: 0 14px;
}
.pi-secondary:disabled {
  cursor: wait;
}
.pi-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  border: 1px solid rgba(154, 103, 0, 0.2);
  border-radius: 10px;
  background: var(--pi-warning-soft);
  color: #6f4a00;
  font-size: 13px;
}
.pi-status strong {
  color: #5f3f00;
  font-weight: 850;
  text-align: right;
  text-transform: capitalize;
}
.pi-bank-actions {
  display: grid;
}
.pi-refresh {
  width: 100%;
}
.pi-redirect-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--pi-border);
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, var(--pi-soft));
}
.pi-redirect-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 999px;
  background: var(--pi-primary-soft);
  color: var(--pi-primary);
  font-size: 20px;
  font-weight: 900;
}
.pi-state {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 34px 14px;
  text-align: center;
}
.pi-state-logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
}
.pi-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid var(--pi-border);
  border-top-color: var(--pi-primary);
  border-radius: 50%;
  animation: pi-spin 0.8s linear infinite;
}
.pi-badge {
  display: inline-grid;
  place-items: center;
  min-width: 40px;
  height: 40px;
  border-radius: 999px;
  font-weight: 900;
}
.pi-badge-success {
  background: var(--pi-success-soft);
  color: var(--pi-success);
}
.pi-badge-error {
  background: var(--pi-danger-soft);
  color: var(--pi-danger);
}
.pi-badge-warning {
  background: var(--pi-warning-soft);
  color: var(--pi-warning);
}
.pi-message {
  margin: 0;
  color: var(--pi-muted);
  font-size: 14px;
  line-height: 1.5;
}
.pi-error {
  padding: 12px;
  border: 1px solid #fecdca;
  border-radius: 10px;
  background: #fffbfa;
  color: var(--pi-danger);
  font-size: 14px;
}
.pi-unavailable {
  padding: 14px;
  border: 1px dashed var(--pi-border-strong);
  border-radius: 10px;
  background: var(--pi-soft);
  color: var(--pi-muted);
  font-size: 14px;
}
.pi-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--pi-border);
  background: var(--pi-raised);
}
.pi-secured {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
  padding: 7px 10px;
  border-radius: 999px;
  background: var(--pi-primary-strong);
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  line-height: 1;
}
.pi-secured strong {
  color: #fff;
  font-weight: 850;
}
.pi-secured-logo {
  width: 15px;
  height: 20px;
  object-fit: contain;
}
.pi-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@keyframes pi-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 520px) {
  .pi-overlay {
    align-items: end;
    padding: 10px;
  }
  .pi-modal {
    width: 100%;
    max-height: calc(100vh - 20px);
    border-radius: 14px 14px 10px 10px;
  }
  .pi-header,
  .pi-body,
  .pi-footer {
    padding: 15px;
  }
  .pi-header {
    gap: 10px;
  }
  .pi-logo-frame {
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }
  .pi-title {
    font-size: 15px;
  }
  .pi-summary-hero {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
  .pi-summary-hero p {
    max-width: none;
    text-align: left;
  }
  .pi-summary-hero strong {
    font-size: 25px;
  }
  .pi-bank-intro,
  .pi-status {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
  .pi-bank-intro strong,
  .pi-status strong {
    text-align: left;
  }
  .pi-bank-grid {
    grid-template-columns: 1fr;
  }
  .pi-account-number {
    font-size: 26px;
  }
  .pi-tabs {
    grid-template-columns: 1fr;
  }
  .pi-footer {
    align-items: stretch;
    flex-direction: column;
  }
  .pi-secured {
    justify-content: center;
  }
}
`;

// src/modal.ts
var focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");
var CheckoutModal = class {
  constructor(options) {
    this.inline = false;
    this.refreshingStatus = false;
    this.options = options;
    this.host = document.createElement("div");
    this.host.setAttribute("data-payisland-checkout", "");
    this.root = this.host.attachShadow({ mode: "open" });
  }
  mount() {
    this.previousActiveElement = document.activeElement;
    const container = this.resolveContainer();
    this.inline = Boolean(container);
    (container ?? document.body).appendChild(this.host);
    this.renderShell();
    this.focusFirst();
  }
  destroy() {
    this.stopCountdown();
    this.host.remove();
    if (this.previousActiveElement instanceof HTMLElement) {
      this.previousActiveElement.focus({ preventScroll: true });
    }
  }
  renderLoading() {
    this.setBody(`
      <div class="pi-state pi-state-loading" role="status" aria-live="polite">
        <img class="pi-state-logo" src="${escapeAttr(payisland_logo_dark_default)}" alt="" />
        <div class="pi-spinner" aria-hidden="true"></div>
        <h3 class="pi-state-title">Preparing checkout</h3>
        <p class="pi-message">Preparing secure checkout...</p>
      </div>
    `);
  }
  getSelectedChannel() {
    return this.selectedChannel;
  }
  renderError(error, retry = true) {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state pi-state-error" role="alert">
        <div class="pi-badge pi-badge-error" aria-hidden="true">!</div>
        <h3 class="pi-state-title">Checkout unavailable</h3>
        <p class="pi-message">${escapeHtml(error.message)}</p>
        ${retry ? '<button class="pi-secondary" type="button" data-action="retry">Retry</button>' : ""}
      </div>
    `);
  }
  renderCheckout(payload, allowedChannels, status) {
    const channels = this.filterChannels(
      extractChannels(payload),
      allowedChannels,
      payload
    );
    if (channels.length === 0) {
      this.selectedChannel = void 0;
      this.renderError(
        {
          code: "no_available_channels",
          message: "No available payment channels for this checkout."
        },
        false
      );
      return false;
    }
    this.selectedChannel = this.selectedChannel && channels.includes(this.selectedChannel) ? this.selectedChannel : channels.find((channel) => this.isSupported(channel, payload)) ?? channels[0];
    this.setBody(`
      <div class="pi-stack">
        ${this.renderSummary(payload)}
        ${this.renderTabs(channels, payload)}
        <div class="pi-panel">${this.renderChannel(payload, this.selectedChannel, status)}</div>
      </div>
    `);
    this.startCountdown(payload);
    return true;
  }
  renderPending(payload) {
    this.setBody(`
      <div class="pi-state pi-state-pending" role="status" aria-live="polite">
        <div class="pi-spinner" aria-hidden="true"></div>
        <h3 class="pi-state-title">Confirming payment</h3>
        <p class="pi-message">Payment is pending. We are checking for confirmation.</p>
        ${payload?.status ? `<p class="pi-subtitle">Status: ${escapeHtml(payload.status)}</p>` : ""}
      </div>
    `);
  }
  renderSuccess() {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state pi-state-success" role="status" aria-live="polite">
        <div class="pi-badge pi-badge-success" aria-hidden="true">\u2713</div>
        <h3 class="pi-state-title">Payment successful</h3>
        <p class="pi-message">Payment successful.</p>
      </div>
    `);
  }
  renderFailure(message) {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state pi-state-error" role="alert">
        <div class="pi-badge pi-badge-error" aria-hidden="true">!</div>
        <h3 class="pi-state-title">Payment failed</h3>
        <p class="pi-message">${escapeHtml(message)}</p>
      </div>
    `);
  }
  renderExpired() {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state pi-state-expired" role="alert">
        <div class="pi-badge pi-badge-warning" aria-hidden="true">!</div>
        <h3 class="pi-state-title">Checkout expired</h3>
        <p class="pi-message">This checkout has expired. Please start a new payment.</p>
      </div>
    `);
  }
  setStatusRefreshing(refreshing) {
    this.refreshingStatus = refreshing;
    const button = this.root.querySelector(
      '[data-action="refresh-status"]'
    );
    if (!button) return;
    button.disabled = refreshing;
    button.textContent = refreshing ? "Checking..." : "Refresh status";
  }
  renderShell() {
    const merchantName = this.options.theme.merchantName ?? "PayIsland Checkout";
    const logo = this.options.theme.logoUrl ?? payisland_logo_dark_default;
    const wrapperClass = this.inline ? "pi-inline" : "pi-overlay";
    this.root.innerHTML = `
      <style>${styles}</style>
      <div class="${wrapperClass}" data-shell>
        <section class="pi-modal" role="dialog" aria-modal="${this.inline ? "false" : "true"}" aria-labelledby="pi-title">
          <header class="pi-header">
            <div class="pi-header-main">
              <div class="pi-logo-frame">
                <img class="pi-logo" src="${escapeAttr(logo)}" alt="" />
              </div>
              <div class="pi-heading">
                <p class="pi-eyebrow">Secure checkout</p>
                <h2 class="pi-title" id="pi-title">${escapeHtml(merchantName)}</h2>
                <p class="pi-subtitle">Protected by PayIsland</p>
              </div>
            </div>
            <button class="pi-close" type="button" aria-label="Close checkout" data-action="close">
              <span aria-hidden="true">\xD7</span>
            </button>
          </header>
          <main class="pi-body" data-body></main>
          <footer class="pi-footer">
            <div class="pi-secured">
              <span>Secured by</span>
              <img class="pi-secured-logo" src="${escapeAttr(payisland_logo_light_default)}" alt="PayIsland" />
              <strong>PayIsland</strong>
            </div>
            <button class="pi-secondary" type="button" data-action="close">Cancel</button>
          </footer>
        </section>
      </div>
    `;
    this.root.querySelector("[data-shell]")?.addEventListener("click", (event) => {
      if (!this.inline && event.target === event.currentTarget)
        this.options.onClose("user");
    });
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener(
      "keydown",
      (event) => this.handleKeydown(event)
    );
    if (this.options.theme.primaryColor) {
      this.host.style.setProperty(
        "--pi-primary",
        this.options.theme.primaryColor
      );
    }
  }
  setBody(html) {
    const body = this.root.querySelector("[data-body]");
    if (body) body.innerHTML = html;
  }
  renderSummary(payload) {
    const transaction = extractTransaction(payload);
    const merchant = extractMerchant(payload);
    const customer = extractCustomer(payload);
    const currency = transaction.currency ?? payload.currency ?? "NGN";
    const total = transaction.total_amount ?? transaction.totalAmount ?? payload.total_amount ?? payload.totalAmount;
    const amount = transaction.amount ?? payload.amount;
    const fee = transaction.fee ?? payload.fee;
    const customerName = customerDisplayName(customer);
    const customerEmail = maskEmail(customer.email);
    const merchantName = merchantDisplayName(
      merchant,
      this.options.theme.merchantName
    );
    const reference = transaction.reference ?? payload.reference ?? "";
    const totalLabel = formatMoney(total ?? amount, currency);
    return `
      <section class="pi-summary" aria-label="Transaction summary">
        <div class="pi-summary-hero">
          <div>
            <span class="pi-label">Total due</span>
            <strong>${escapeHtml(totalLabel)}</strong>
          </div>
          <p>${escapeHtml(merchantName)}</p>
        </div>
        <div class="pi-summary-grid">
          <div class="pi-row"><span>Amount</span><strong>${escapeHtml(formatMoney(amount, currency))}</strong></div>
          <div class="pi-row"><span>Fee</span><strong>${escapeHtml(formatMoney(fee, currency))}</strong></div>
          ${customerName ? `<div class="pi-row"><span>Customer</span><strong>${escapeHtml(customerName)}</strong></div>` : ""}
          ${customerEmail ? `<div class="pi-row"><span>Email</span><strong>${escapeHtml(customerEmail)}</strong></div>` : ""}
          ${reference ? `<div class="pi-row pi-reference"><span>Reference</span><strong>${escapeHtml(reference)}</strong></div>` : ""}
        </div>
      </section>
    `;
  }
  renderTabs(channels, payload) {
    return `
      <div class="pi-tabs" role="tablist" aria-label="Payment channels">
        ${channels.map((channel) => {
      const supported = this.isSupported(channel, payload);
      return `
              <button
                class="pi-tab"
                type="button"
                role="tab"
                aria-selected="${channel === this.selectedChannel ? "true" : "false"}"
                data-channel="${escapeAttr(channel)}"
                ${supported ? "" : "disabled"}
              >
                ${escapeHtml(labelForChannel(channel))}
              </button>
            `;
    }).join("")}
      </div>
    `;
  }
  renderChannel(payload, channel, status) {
    if (channel === "bank-transfer") {
      const bank = getBankTransferFields(extractBankTransfer(payload));
      const transaction = extractTransaction(payload);
      const currency = transaction.currency ?? payload.currency ?? "NGN";
      const total = transaction.total_amount ?? transaction.totalAmount ?? payload.total_amount ?? payload.totalAmount ?? transaction.amount ?? payload.amount;
      if (!bank)
        return `<div class="pi-unavailable">Bank transfer details are not available yet.</div>`;
      return `
        <section class="pi-bank-box" aria-label="Bank transfer details">
          <div class="pi-bank-intro">
            <span class="pi-label">Bank transfer</span>
            <strong>Transfer exactly ${escapeHtml(formatMoney(total, currency))}</strong>
          </div>
          <div class="pi-account">
            <span>Account number</span>
            <strong class="pi-account-number">${escapeHtml(bank.accountNumber)}</strong>
            <button class="pi-copy" type="button" data-copy="${escapeAttr(bank.accountNumber)}">Copy number</button>
          </div>
          <div class="pi-bank-grid">
            <div class="pi-detail"><span>Bank</span><strong>${escapeHtml(bank.bankName)}</strong></div>
            <div class="pi-detail"><span>Account name</span><strong>${escapeHtml(bank.accountName)}</strong></div>
          </div>
          ${bank.expiresAt ? `<p class="pi-subtitle" data-countdown="${escapeAttr(bank.expiresAt)}"></p>` : ""}
          <div class="pi-status" role="status" aria-live="polite">
            <span>Current status</span>
            <strong>${escapeHtml(labelForStatus(status))}</strong>
          </div>
          <div class="pi-bank-actions">
            <button class="pi-secondary pi-refresh" type="button" data-action="refresh-status" ${this.refreshingStatus ? "disabled" : ""}>
              ${this.refreshingStatus ? "Checking..." : "Refresh status"}
            </button>
          </div>
          <p class="pi-message">Keep this checkout open while we confirm your payment.</p>
        </section>
      `;
    }
    if (channel === "redirect" || safeUrl(extractAuthorizationUrl(payload))) {
      const url = safeUrl(extractAuthorizationUrl(payload));
      return `
        <section class="pi-redirect-card">
          <div class="pi-redirect-icon" aria-hidden="true">\u2197</div>
          <div>
            <h3 class="pi-panel-title">Continue securely</h3>
            <p class="pi-message">You will continue to a secure PayIsland payment page. Keep this checkout open while we confirm the payment.</p>
          </div>
          <button class="pi-primary" type="button" data-redirect="${escapeAttr(url ?? "")}" ${url ? "" : "disabled"}>
            Continue to payment
          </button>
        </section>
      `;
    }
    if (channel === "card") {
      return `<div class="pi-unavailable">${escapeHtml(cardUnavailableMessage())}</div>`;
    }
    return `<div class="pi-unavailable">${escapeHtml(labelForChannel(channel ?? "This channel"))} is not available in this checkout yet.</div>`;
  }
  startCountdown(payload) {
    this.stopCountdown();
    const bank = getBankTransferFields(extractBankTransfer(payload));
    if (!bank?.expiresAt) return;
    const target = new Date(bank.expiresAt).getTime();
    const element = this.root.querySelector("[data-countdown]");
    if (!Number.isFinite(target) || !element) return;
    const update = () => {
      const remaining = Math.max(0, target - Date.now());
      const minutes = Math.floor(remaining / 6e4);
      const seconds = Math.floor(remaining % 6e4 / 1e3);
      element.textContent = remaining > 0 ? `Transfer account expires in ${minutes}:${seconds.toString().padStart(2, "0")}` : "Transfer account has expired.";
    };
    update();
    this.countdownTimer = window.setInterval(update, 1e3);
  }
  stopCountdown() {
    if (this.countdownTimer) {
      window.clearInterval(this.countdownTimer);
      this.countdownTimer = void 0;
    }
  }
  filterChannels(channels, allowedChannels, payload) {
    const unique = [...new Set(channels)];
    if (allowedChannels?.length) {
      return unique.filter(
        (channel) => allowedChannels.includes(channel) && (payload ? this.isSupported(channel, payload) : true)
      );
    }
    return unique.length > 0 ? unique : ["bank-transfer", "redirect", "card"];
  }
  isSupported(channel, payload) {
    if (channel === "bank-transfer")
      return Boolean(extractBankTransfer(payload));
    if (channel === "redirect")
      return Boolean(safeUrl(extractAuthorizationUrl(payload)));
    return channel === "card" ? false : false;
  }
  handleClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const close2 = target.closest('[data-action="close"]');
    if (close2) {
      this.options.onClose("user");
      return;
    }
    const retry = target.closest('[data-action="retry"]');
    if (retry) {
      this.options.onRetry();
      return;
    }
    const refreshStatus = target.closest(
      '[data-action="refresh-status"]'
    );
    if (refreshStatus) {
      this.options.onRefreshStatus();
      return;
    }
    const channel = target.closest("[data-channel]")?.dataset.channel;
    if (channel) {
      this.selectedChannel = channel;
      this.options.onChannelSelected(channel);
      return;
    }
    const copy = target.closest("[data-copy]")?.dataset.copy;
    if (copy) {
      void navigator.clipboard?.writeText(copy);
      target.textContent = "Copied";
      return;
    }
    const redirect = target.closest("[data-redirect]")?.dataset.redirect;
    if (redirect) openRedirect(redirect);
  }
  handleKeydown(event) {
    if (event.key === "Escape") {
      this.options.onClose("user");
      return;
    }
    if (event.key !== "Tab" || this.inline) return;
    const focusable = Array.from(
      this.root.querySelectorAll(focusableSelector)
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active2 = this.root.activeElement;
    if (event.shiftKey && active2 === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active2 === last) {
      event.preventDefault();
      first.focus();
    }
  }
  focusFirst() {
    window.setTimeout(() => {
      this.root.querySelector(focusableSelector)?.focus();
    }, 0);
  }
  resolveContainer() {
    const container = this.options.container;
    if (!container) return void 0;
    if (container instanceof HTMLElement) return container;
    return document.querySelector(container) ?? void 0;
  }
};
function labelForChannel(channel) {
  const labels = {
    "bank-transfer": "Bank transfer",
    redirect: "Redirect",
    card: "Card",
    mono: "Mono"
  };
  return labels[channel] ?? String(channel);
}
function labelForStatus(status) {
  if (!status) return "Pending confirmation";
  const normalized = String(status).trim();
  if (!normalized) return "Pending confirmation";
  return normalized.replace(/[-_]+/g, " ");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function escapeAttr(value) {
  return escapeHtml(value);
}

// src/polling.ts
var VerificationPoller = class {
  constructor() {
    this.stopped = true;
  }
  start(verify, onResult, initialDelay = 0) {
    this.stop();
    this.stopped = false;
    const tick = async () => {
      if (this.stopped) return;
      try {
        const payload = await verify();
        if (this.stopped) return;
        onResult(payload);
        if (this.stopped) return;
        this.timer = window.setTimeout(tick, getPollDelay(payload));
      } catch {
        if (!this.stopped) this.timer = window.setTimeout(tick, 5e3);
      }
    };
    this.timer = window.setTimeout(tick, initialDelay);
  }
  stop() {
    this.stopped = true;
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = void 0;
    }
  }
};

// src/state-machine.ts
var transitions = {
  idle: { LOAD: "loading", CLOSE: "closed" },
  loading: {
    READY: "ready",
    PENDING: "pending",
    SUCCESS: "success",
    FAIL: "failed",
    EXPIRE: "expired",
    CLOSE: "closed"
  },
  ready: {
    PENDING: "pending",
    SUCCESS: "success",
    FAIL: "failed",
    EXPIRE: "expired",
    CLOSE: "closed"
  },
  pending: {
    READY: "ready",
    PENDING: "pending",
    SUCCESS: "success",
    FAIL: "failed",
    EXPIRE: "expired",
    CLOSE: "closed"
  },
  success: { CLOSE: "closed" },
  failed: { CLOSE: "closed" },
  expired: { CLOSE: "closed" },
  closed: {}
};
var CheckoutStateMachine = class {
  constructor(context) {
    this.context = context;
  }
  send(event) {
    const next = transitions[this.context.status][event.type];
    if (next) this.context.status = next;
    return this.context.status;
  }
  isTerminal() {
    return this.context.status === "success" || this.context.status === "failed" || this.context.status === "expired" || this.context.status === "closed";
  }
};

// src/index.ts
var active;
function open(options) {
  close(false);
  let reference;
  try {
    reference = validateReference(options?.reference);
  } catch (error) {
    const payload = toErrorPayload(error);
    options?.onError?.(payload);
    renderValidationError(options, payload);
    return;
  }
  let api;
  try {
    api = new ApiClient(resolveApiBaseUrl(options.__apiBaseUrl));
  } catch (error) {
    const payload = toErrorPayload(error);
    options.onError?.(payload);
    renderValidationError(options, payload);
    return;
  }
  const machine = new CheckoutStateMachine({
    reference,
    theme: options.theme ?? {},
    status: "idle"
  });
  const poller = new VerificationPoller();
  const modal = new CheckoutModal({
    container: options.container,
    theme: options.theme ?? {},
    onClose: (reason) => close(reason === "user"),
    onRetry: () => void bootstrapActive(),
    onChannelSelected: () => {
      if (active?.bootstrap)
        active.modal.renderCheckout(
          active.bootstrap,
          active.options.channels,
          active.machine.context.status
        );
    },
    onRefreshStatus: () => void refreshActiveStatus()
  });
  active = {
    options,
    reference,
    api,
    modal,
    poller,
    machine,
    successCalled: false,
    errorCalled: false,
    closeCalled: false
  };
  modal.mount();
  void bootstrapActive();
}
function close(callCallback = true) {
  if (!active) return;
  const checkout = active;
  active = void 0;
  checkout.poller.stop();
  checkout.machine.send({ type: "CLOSE" });
  checkout.modal.destroy();
  checkout.api?.setCheckoutToken(void 0);
  checkout.bootstrap = void 0;
  if (callCallback && !checkout.closeCalled) {
    checkout.closeCalled = true;
    checkout.options.onClose?.();
  }
}
async function bootstrapActive() {
  const checkout = active;
  if (!checkout || !checkout.api) return;
  checkout.poller.stop();
  checkout.machine.send({ type: "LOAD" });
  checkout.modal.renderLoading();
  try {
    const response = await checkout.api.bootstrap(checkout.reference);
    if (active !== checkout) return;
    checkout.bootstrap = response.data;
    checkout.machine.context.bootstrap = response.data;
    checkout.machine.context.checkoutToken = response.checkoutToken;
    checkout.api.setCheckoutToken(response.checkoutToken);
    const hasAvailableChannel = checkout.modal.renderCheckout(
      response.data,
      checkout.options.channels
    );
    if (!hasAvailableChannel) {
      checkout.machine.send({ type: "FAIL" });
      callErrorOnce({
        code: "no_available_channels",
        message: "No available payment channels for this checkout."
      });
      return;
    }
    handlePayload(response.data, false);
    const status = normalizeStatus(extractStatus(response.data));
    if (status === "unknown" || status === "pending") {
      startPolling(getPollDelay(response.data));
    }
  } catch (error) {
    if (active !== checkout) return;
    const payload = toErrorPayload(error);
    checkout.machine.context.error = payload;
    checkout.machine.send({ type: "FAIL" });
    checkout.modal.renderError(payload);
    callErrorOnce(payload);
  }
}
function startPolling(delay) {
  const checkout = active;
  if (!checkout || !checkout.api) return;
  checkout.poller.start(
    () => verifyActive(checkout),
    (payload) => handlePayload(payload, true),
    delay
  );
}
async function refreshActiveStatus() {
  const checkout = active;
  if (!checkout || !checkout.api) return;
  checkout.poller.stop();
  checkout.modal.setStatusRefreshing(true);
  try {
    const payload = await verifyActive(checkout);
    if (active !== checkout) return;
    handlePayload(payload, true);
    if (!checkout.machine.isTerminal()) {
      startPolling(getPollDelay(payload));
    }
  } catch {
    if (active === checkout && !checkout.machine.isTerminal()) {
      startPolling(5e3);
    }
  } finally {
    if (active === checkout) checkout.modal.setStatusRefreshing(false);
  }
}
async function verifyActive(checkout) {
  if (!checkout.api) return {};
  if (checkout.modal.getSelectedChannel() === "bank-transfer" && extractBankTransfer(checkout.bootstrap)) {
    try {
      const response2 = await checkout.api.verifyBankTransfer(
        checkout.reference
      );
      return response2.data;
    } catch {
      const response2 = await checkout.api.verify(checkout.reference);
      return response2.data;
    }
  }
  const response = await checkout.api.verify(checkout.reference);
  return response.data;
}
function handlePayload(payload, fromPoll) {
  const checkout = active;
  if (!checkout) return;
  const status = normalizeStatus(extractStatus(payload));
  const transaction = extractTransaction(payload);
  if (status === "success") {
    checkout.poller.stop();
    checkout.machine.send({ type: "SUCCESS" });
    checkout.modal.renderSuccess();
    if (!checkout.successCalled) {
      checkout.successCalled = true;
      checkout.options.onSuccess?.(transaction);
    }
    return;
  }
  if (status === "expired") {
    checkout.poller.stop();
    checkout.machine.send({ type: "EXPIRE" });
    checkout.modal.renderExpired();
    callErrorOnce({
      code: "payment_expired",
      message: "This checkout has expired. Please start a new payment."
    });
    return;
  }
  if (status === "failed") {
    checkout.poller.stop();
    checkout.machine.send({ type: "FAIL" });
    checkout.modal.renderFailure("This payment could not be completed.");
    callErrorOnce({
      code: "payment_failed",
      message: "This payment could not be completed."
    });
    return;
  }
  if (fromPoll || status === "pending") {
    checkout.machine.send({ type: "PENDING" });
    if (checkout.modal.getSelectedChannel() === "bank-transfer" && checkout.bootstrap && extractBankTransfer(checkout.bootstrap)) {
      checkout.modal.renderCheckout(
        checkout.bootstrap,
        checkout.options.channels,
        extractStatus(payload) ?? "pending"
      );
    } else {
      checkout.modal.renderPending(payload);
    }
    checkout.options.onPending?.(payload);
  } else {
    checkout.machine.send({ type: "READY" });
  }
}
function callErrorOnce(payload) {
  const checkout = active;
  if (!checkout || checkout.errorCalled) return;
  checkout.errorCalled = true;
  checkout.options.onError?.(payload);
}
function renderValidationError(options, error) {
  const modal = new CheckoutModal({
    container: options?.container,
    theme: options?.theme ?? {},
    onClose: (reason) => close(reason === "user"),
    onRetry: () => void 0,
    onChannelSelected: () => void 0,
    onRefreshStatus: () => void 0
  });
  const machine = new CheckoutStateMachine({
    reference: "",
    theme: options?.theme ?? {},
    status: "failed"
  });
  active = {
    options: options ?? { reference: "" },
    reference: "",
    modal,
    poller: new VerificationPoller(),
    machine,
    successCalled: false,
    errorCalled: true,
    closeCalled: false
  };
  modal.mount();
  modal.renderError(error, false);
}
function toErrorPayload(error) {
  if (error instanceof CheckoutError) return error.toPayload();
  return {
    code: "checkout_error",
    message: "We could not continue with this checkout."
  };
}
var PayIslandCheckout = { open, close };
if (typeof window !== "undefined") {
  window.PayIslandCheckout = PayIslandCheckout;
}
var index_default = PayIslandCheckout;
//# sourceMappingURL=index.cjs.map
