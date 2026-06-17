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
function logoUrl(merchant, fallback) {
  return fallback ?? merchant.logo_url ?? merchant.logo;
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

// src/styles.ts
var styles = `
:host {
  all: initial;
  --pi-primary: #0b7f70;
  --pi-primary-strong: #075f55;
  --pi-text: #17202a;
  --pi-muted: #5f6c7b;
  --pi-border: #d9e2ec;
  --pi-surface: #ffffff;
  --pi-soft: #f5f8fb;
  --pi-danger: #b42318;
  --pi-success: #087443;
  --pi-warning: #9a6700;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* {
  box-sizing: border-box;
}
button,
input {
  font: inherit;
}
.pi-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.54);
}
.pi-inline {
  width: 100%;
}
.pi-modal {
  width: min(100%, 460px);
  max-height: min(760px, calc(100vh - 40px));
  overflow: hidden;
  border: 1px solid var(--pi-border);
  border-radius: 8px;
  background: var(--pi-surface);
  color: var(--pi-text);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
}
.pi-inline .pi-modal {
  max-height: none;
  box-shadow: none;
}
.pi-header,
.pi-body,
.pi-footer {
  padding: 18px 20px;
}
.pi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--pi-border);
}
.pi-brand {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
}
.pi-logo,
.pi-logo-fallback {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 8px;
  object-fit: cover;
}
.pi-logo-fallback {
  display: grid;
  place-items: center;
  background: var(--pi-primary);
  color: #fff;
  font-weight: 700;
}
.pi-title {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
}
.pi-subtitle {
  margin: 3px 0 0;
  color: var(--pi-muted);
  font-size: 13px;
}
.pi-close {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--pi-muted);
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
}
.pi-close:hover,
.pi-close:focus-visible {
  background: var(--pi-soft);
  color: var(--pi-text);
  outline: none;
}
.pi-body {
  max-height: calc(100vh - 190px);
  overflow-y: auto;
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
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--pi-border);
  border-radius: 8px;
  background: var(--pi-soft);
}
.pi-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--pi-muted);
  font-size: 14px;
}
.pi-row strong {
  color: var(--pi-text);
  font-weight: 700;
  text-align: right;
}
.pi-row.pi-total {
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid var(--pi-border);
  color: var(--pi-text);
}
.pi-row.pi-total strong {
  font-size: 18px;
}
.pi-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
}
.pi-tab {
  min-height: 40px;
  border: 1px solid var(--pi-border);
  border-radius: 8px;
  background: #fff;
  color: var(--pi-text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
}
.pi-tab[aria-selected="true"] {
  border-color: var(--pi-primary);
  background: color-mix(in srgb, var(--pi-primary) 12%, #fff);
  color: var(--pi-primary-strong);
}
.pi-tab[disabled] {
  cursor: not-allowed;
  opacity: 0.55;
}
.pi-panel {
  display: grid;
  gap: 12px;
}
.pi-bank-box {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--pi-border);
  border-radius: 8px;
}
.pi-account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.pi-account-number {
  font-size: 22px;
  font-weight: 750;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}
.pi-copy,
.pi-primary,
.pi-secondary {
  min-height: 42px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
}
.pi-copy {
  border: 1px solid var(--pi-border);
  background: #fff;
  color: var(--pi-text);
  padding: 0 12px;
}
.pi-primary {
  width: 100%;
  border: 0;
  background: var(--pi-primary);
  color: #fff;
}
.pi-primary:hover,
.pi-primary:focus-visible {
  background: var(--pi-primary-strong);
  outline: none;
}
.pi-secondary {
  border: 1px solid var(--pi-border);
  background: #fff;
  color: var(--pi-text);
  padding: 0 14px;
}
.pi-secondary:disabled {
  cursor: wait;
  opacity: 0.65;
}
.pi-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--pi-soft);
  color: var(--pi-muted);
  font-size: 13px;
}
.pi-status strong {
  color: var(--pi-text);
  font-weight: 700;
  text-align: right;
  text-transform: capitalize;
}
.pi-refresh {
  width: 100%;
}
.pi-state {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 28px 10px;
  text-align: center;
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
  min-width: 36px;
  height: 36px;
  border-radius: 999px;
  font-weight: 800;
}
.pi-badge-success {
  background: #dcfce7;
  color: var(--pi-success);
}
.pi-badge-error {
  background: #fee4e2;
  color: var(--pi-danger);
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
  border-radius: 8px;
  background: #fffbfa;
  color: var(--pi-danger);
  font-size: 14px;
}
.pi-unavailable {
  padding: 12px;
  border: 1px dashed var(--pi-border);
  border-radius: 8px;
  color: var(--pi-muted);
  font-size: 14px;
}
.pi-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid var(--pi-border);
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
    padding: 12px;
  }
  .pi-modal {
    width: 100%;
    max-height: calc(100vh - 24px);
  }
  .pi-header,
  .pi-body,
  .pi-footer {
    padding: 16px;
  }
  .pi-row,
  .pi-account {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
  .pi-row strong {
    text-align: left;
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
      <div class="pi-state" role="status" aria-live="polite">
        <div class="pi-spinner" aria-hidden="true"></div>
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
      <div class="pi-state" role="alert">
        <div class="pi-badge pi-badge-error" aria-hidden="true">!</div>
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
      <div class="pi-state" role="status" aria-live="polite">
        <div class="pi-spinner" aria-hidden="true"></div>
        <p class="pi-message">Payment is pending. We are checking for confirmation.</p>
        ${payload?.status ? `<p class="pi-subtitle">Status: ${escapeHtml(payload.status)}</p>` : ""}
      </div>
    `);
  }
  renderSuccess() {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state" role="status" aria-live="polite">
        <div class="pi-badge pi-badge-success" aria-hidden="true">\u2713</div>
        <p class="pi-message">Payment successful.</p>
      </div>
    `);
  }
  renderFailure(message) {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state" role="alert">
        <div class="pi-badge pi-badge-error" aria-hidden="true">!</div>
        <p class="pi-message">${escapeHtml(message)}</p>
      </div>
    `);
  }
  renderExpired() {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state" role="alert">
        <div class="pi-badge pi-badge-error" aria-hidden="true">!</div>
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
    const logo = this.options.theme.logoUrl;
    const wrapperClass = this.inline ? "pi-inline" : "pi-overlay";
    this.root.innerHTML = `
      <style>${styles}</style>
      <div class="${wrapperClass}" data-shell>
        <section class="pi-modal" role="dialog" aria-modal="${this.inline ? "false" : "true"}" aria-labelledby="pi-title">
          <header class="pi-header">
            <div class="pi-brand">
              ${logo ? `<img class="pi-logo" src="${escapeAttr(logo)}" alt="" />` : `<div class="pi-logo-fallback" aria-hidden="true">PI</div>`}
              <div>
                <h2 class="pi-title" id="pi-title">${escapeHtml(merchantName)}</h2>
                <p class="pi-subtitle">Secure PayIsland checkout</p>
              </div>
            </div>
            <button class="pi-close" type="button" aria-label="Close checkout" data-action="close">\xD7</button>
          </header>
          <main class="pi-body" data-body></main>
          <footer class="pi-footer">
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
    const merchantLogo = logoUrl(merchant, this.options.theme.logoUrl);
    return `
      <section class="pi-summary" aria-label="Transaction summary">
        <div class="pi-brand">
          ${merchantLogo ? `<img class="pi-logo" src="${escapeAttr(merchantLogo)}" alt="" />` : `<div class="pi-logo-fallback" aria-hidden="true">PI</div>`}
          <div>
            <p class="pi-title">${escapeHtml(merchantDisplayName(merchant, this.options.theme.merchantName))}</p>
            <p class="pi-subtitle">${escapeHtml(transaction.reference ?? payload.reference ?? "")}</p>
          </div>
        </div>
        ${customerName ? `<div class="pi-row"><span>Customer</span><strong>${escapeHtml(customerName)}</strong></div>` : ""}
        ${customerEmail ? `<div class="pi-row"><span>Email</span><strong>${escapeHtml(customerEmail)}</strong></div>` : ""}
        <div class="pi-row"><span>Amount</span><strong>${escapeHtml(formatMoney(amount, currency))}</strong></div>
        <div class="pi-row"><span>Fee</span><strong>${escapeHtml(formatMoney(fee, currency))}</strong></div>
        <div class="pi-row pi-total"><span>Total</span><strong>${escapeHtml(formatMoney(total ?? amount, currency))}</strong></div>
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
      if (!bank)
        return `<div class="pi-unavailable">Bank transfer details are not available yet.</div>`;
      return `
        <section class="pi-bank-box" aria-label="Bank transfer details">
          <div class="pi-row"><span>Bank</span><strong>${escapeHtml(bank.bankName)}</strong></div>
          <div class="pi-row"><span>Account name</span><strong>${escapeHtml(bank.accountName)}</strong></div>
          <div class="pi-account">
            <span class="pi-account-number">${escapeHtml(bank.accountNumber)}</span>
            <button class="pi-copy" type="button" data-copy="${escapeAttr(bank.accountNumber)}">Copy</button>
          </div>
          <p class="pi-message">Transfer the exact amount, then keep this checkout open while we confirm payment.</p>
          ${bank.expiresAt ? `<p class="pi-subtitle" data-countdown="${escapeAttr(bank.expiresAt)}"></p>` : ""}
          <div class="pi-status" role="status" aria-live="polite">
            <span>Current status</span>
            <strong>${escapeHtml(labelForStatus(status))}</strong>
          </div>
          <button class="pi-secondary pi-refresh" type="button" data-action="refresh-status" ${this.refreshingStatus ? "disabled" : ""}>
            ${this.refreshingStatus ? "Checking..." : "Refresh status"}
          </button>
        </section>
      `;
    }
    if (channel === "redirect" || safeUrl(extractAuthorizationUrl(payload))) {
      const url = safeUrl(extractAuthorizationUrl(payload));
      return `
        <section class="pi-panel">
          <p class="pi-message">Continue to PayIsland to complete this payment securely.</p>
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
export {
  close,
  index_default as default,
  open
};
//# sourceMappingURL=index.mjs.map
