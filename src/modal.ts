import { getBankTransferFields } from "./channels/bank-transfer";
import { payIslandLogoDark, payIslandLogoLight } from "./brand-assets";
import { styles } from "./styles";
import type {
  BootstrapPayload,
  CheckoutErrorPayload,
  CheckoutTheme,
  PaymentChannel,
  VerificationPayload,
} from "./types";
import {
  customerDisplayName,
  extractAuthorizationUrl,
  extractBankTransfer,
  extractChannels,
  extractCustomer,
  extractMerchant,
  extractTransaction,
  formatMoney,
  maskEmail,
  merchantDisplayName,
  normalizePaymentChannel,
  safeUrl,
} from "./utils";

type CloseReason = "user" | "programmatic";

interface ModalOptions {
  container?: HTMLElement | string;
  theme: CheckoutTheme;
  onClose: (reason: CloseReason) => void;
  onRetry: () => void;
  onChannelSelected: (channel: PaymentChannel) => void;
  onPaymentStarted: (channel: PaymentChannel) => void;
  onRefreshStatus: () => void;
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export class CheckoutModal {
  private readonly host: HTMLDivElement;
  private readonly root: ShadowRoot;
  private readonly options: ModalOptions;
  private selectedChannel?: PaymentChannel;
  private countdownTimer?: number;
  private previousActiveElement?: Element | null;
  private inline = false;
  private refreshingStatus = false;
  private loadingChannel?: PaymentChannel;

  constructor(options: ModalOptions) {
    this.options = options;
    this.host = document.createElement("div");
    this.host.setAttribute("data-payisland-checkout", "");
    this.root = this.host.attachShadow({ mode: "open" });
  }

  mount(): void {
    this.previousActiveElement = document.activeElement;
    const container = this.resolveContainer();
    this.inline = Boolean(container);
    (container ?? document.body).appendChild(this.host);
    this.renderShell();
    this.focusFirst();
  }

  destroy(): void {
    this.stopCountdown();
    this.host.remove();
    if (this.previousActiveElement instanceof HTMLElement) {
      this.previousActiveElement.focus({ preventScroll: true });
    }
  }

  renderLoading(): void {
    this.setBody(`
      <div class="pi-state pi-state-loading" role="status" aria-live="polite">
        <img class="pi-state-logo" src="${escapeAttr(payIslandLogoDark)}" alt="" />
        <div class="pi-spinner" aria-hidden="true"></div>
        <h3 class="pi-state-title">Preparing checkout</h3>
        <p class="pi-message">Preparing secure checkout...</p>
      </div>
    `);
  }

  getSelectedChannel(): PaymentChannel | undefined {
    return this.selectedChannel;
  }

  renderError(error: CheckoutErrorPayload, retry = true): void {
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

  renderCheckout(
    payload: BootstrapPayload,
    allowedChannels?: PaymentChannel[],
    status?: string,
  ): boolean {
    const channels = this.filterChannels(
      extractChannels(payload),
      allowedChannels,
      payload,
    );
    if (channels.length === 0) {
      this.selectedChannel = undefined;
      this.renderError(
        {
          code: "no_available_channels",
          message: "No available payment channels for this checkout.",
        },
        false,
      );
      return false;
    }

    this.selectedChannel =
      this.selectedChannel && channels.includes(this.selectedChannel)
        ? this.selectedChannel
        : (channels.find((channel) => this.isSupported(channel, payload)) ??
          channels[0]);

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

  renderPending(payload?: VerificationPayload): void {
    this.setBody(`
      <div class="pi-state pi-state-pending" role="status" aria-live="polite">
        <div class="pi-spinner" aria-hidden="true"></div>
        <h3 class="pi-state-title">Confirming payment</h3>
        <p class="pi-message">Payment is pending. We are checking for confirmation.</p>
        ${payload?.status ? `<p class="pi-subtitle">Status: ${escapeHtml(payload.status)}</p>` : ""}
      </div>
    `);
  }

  renderSuccess(): void {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state pi-state-success" role="status" aria-live="polite">
        <div class="pi-badge pi-badge-success" aria-hidden="true">✓</div>
        <h3 class="pi-state-title">Payment successful</h3>
        <p class="pi-message">Payment successful.</p>
      </div>
    `);
  }

  renderFailure(message: string): void {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state pi-state-error" role="alert">
        <div class="pi-badge pi-badge-error" aria-hidden="true">!</div>
        <h3 class="pi-state-title">Payment failed</h3>
        <p class="pi-message">${escapeHtml(message)}</p>
      </div>
    `);
  }

  renderExpired(): void {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state pi-state-expired" role="alert">
        <div class="pi-badge pi-badge-warning" aria-hidden="true">!</div>
        <h3 class="pi-state-title">Checkout expired</h3>
        <p class="pi-message">This checkout has expired. Please start a new payment.</p>
      </div>
    `);
  }

  setStatusRefreshing(refreshing: boolean): void {
    this.refreshingStatus = refreshing;
    const button = this.root.querySelector<HTMLButtonElement>(
      '[data-action="refresh-status"]',
    );
    if (!button) return;
    button.disabled = refreshing;
    button.textContent = refreshing ? "Checking..." : "Refresh status";
  }

  setChannelLoading(channel: PaymentChannel, loading: boolean): void {
    this.loadingChannel = loading ? channel : undefined;
  }

  private renderShell(): void {
    const merchantName =
      this.options.theme.merchantName ?? "PayIsland Checkout";
    const logo = this.options.theme.logoUrl ?? payIslandLogoDark;
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
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <main class="pi-body" data-body></main>
          <footer class="pi-footer">
            <div class="pi-secured">
              <span>Secured by</span>
              <img class="pi-secured-logo" src="${escapeAttr(payIslandLogoLight)}" alt="PayIsland" />
              <strong>PayIsland</strong>
            </div>
            <button class="pi-secondary" type="button" data-action="close">Cancel</button>
          </footer>
        </section>
      </div>
    `;

    this.root
      .querySelector("[data-shell]")
      ?.addEventListener("click", (event) => {
        if (!this.inline && event.target === event.currentTarget)
          this.options.onClose("user");
      });

    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("keydown", (event) =>
      this.handleKeydown(event as KeyboardEvent),
    );

    if (this.options.theme.primaryColor) {
      this.host.style.setProperty(
        "--pi-primary",
        this.options.theme.primaryColor,
      );
    }
  }

  private setBody(html: string): void {
    const body = this.root.querySelector<HTMLElement>("[data-body]");
    if (body) body.innerHTML = html;
  }

  private renderSummary(payload: BootstrapPayload): string {
    const transaction = extractTransaction(payload);
    const merchant = extractMerchant(payload);
    const customer = extractCustomer(payload);
    const currency = transaction.currency ?? payload.currency ?? "NGN";
    const total =
      transaction.total_amount ??
      transaction.totalAmount ??
      transaction.amount_to_be_paid ??
      transaction.amountToBePaid ??
      payload.total_amount ??
      payload.totalAmount ??
      payload.amount_to_be_paid ??
      payload.amountToBePaid;
    const amount = transaction.amount ?? payload.amount;
    const fee =
      transaction.fee ??
      transaction.transaction_fee ??
      payload.fee ??
      payload.transaction_fee;
    const customerName = customerDisplayName(customer);
    const customerEmail = maskEmail(customer.email);
    const merchantName = merchantDisplayName(
      merchant,
      this.options.theme.merchantName,
    );
    const reference = transaction.reference ?? payload.reference ?? "";
    const totalLabel = formatMoney(
      total ?? sumMoney(amount, fee) ?? amount,
      currency,
    );

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

  private renderTabs(
    channels: PaymentChannel[],
    payload: BootstrapPayload,
  ): string {
    return `
      <div class="pi-tabs" role="tablist" aria-label="Payment channels">
        ${channels
          .map((channel) => {
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
          })
          .join("")}
      </div>
    `;
  }

  private renderChannel(
    payload: BootstrapPayload,
    channel?: PaymentChannel,
    status?: string,
  ): string {
    if (channel && this.loadingChannel === channel) {
      return `
        <div class="pi-state pi-state-loading" role="status" aria-live="polite">
          <div class="pi-spinner" aria-hidden="true"></div>
          <h3 class="pi-state-title">Preparing ${escapeHtml(labelForChannel(channel))}</h3>
          <p class="pi-message">Setting up this payment method...</p>
        </div>
      `;
    }

    if (channel === "bank-transfer") {
      const bank = getBankTransferFields(extractBankTransfer(payload));
      const transaction = extractTransaction(payload);
      const currency = transaction.currency ?? payload.currency ?? "NGN";
      const amount = transaction.amount ?? payload.amount;
      const fee =
        transaction.fee ??
        transaction.transaction_fee ??
        payload.fee ??
        payload.transaction_fee;
      const total =
        transaction.total_amount ??
        transaction.totalAmount ??
        transaction.amount_to_be_paid ??
        transaction.amountToBePaid ??
        payload.total_amount ??
        payload.totalAmount ??
        payload.amount_to_be_paid ??
        payload.amountToBePaid ??
        sumMoney(amount, fee) ??
        amount;
      if (!bank)
        return `
          <section class="pi-redirect-card">
            <div class="pi-redirect-icon" aria-hidden="true">↗</div>
            <div>
              <h3 class="pi-panel-title">Generate transfer details</h3>
              <p class="pi-message">Generate a dedicated account number and transfer the exact amount.</p>
            </div>
            <button class="pi-primary" type="button" data-action="initialize-channel" data-channel-target="bank-transfer">
              Continue to transfer
            </button>
          </section>
        `;

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

    if (channel === "card") {
      const frameUrl = buildCardFrameUrl(payload);
      if (frameUrl) {
        return `
          <section class="pi-card-frame-card" aria-label="Secure card payment">
            <div>
              <h3 class="pi-panel-title">Card payment</h3>
              <p class="pi-message">Enter card details securely with PayIsland.</p>
            </div>
            <iframe
              class="pi-card-frame"
              src="${escapeAttr(frameUrl)}"
              title="Secure PayIsland card payment"
              loading="lazy"
              referrerpolicy="strict-origin-when-cross-origin"
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
            ></iframe>
          </section>
        `;
      }

      return `
        <section class="pi-redirect-card">
          <div class="pi-redirect-icon" aria-hidden="true">↗</div>
          <div>
            <h3 class="pi-panel-title">Card payment</h3>
            <p class="pi-message">Set up a secure card payment session with PayIsland.</p>
          </div>
          <button
            class="pi-primary"
            type="button"
            data-action="initialize-channel"
            data-channel-target="card"
          >
            Continue to card payment
          </button>
        </section>
      `;
    }

    return `<div class="pi-unavailable">${escapeHtml(labelForChannel(channel ?? "This channel"))} is not available in this checkout yet.</div>`;
  }

  private startCountdown(payload: BootstrapPayload): void {
    this.stopCountdown();
    const bank = getBankTransferFields(extractBankTransfer(payload));
    if (!bank?.expiresAt) return;

    const target = new Date(bank.expiresAt).getTime();
    const element = this.root.querySelector<HTMLElement>("[data-countdown]");
    if (!Number.isFinite(target) || !element) return;

    const update = () => {
      const remaining = Math.max(0, target - Date.now());
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      element.textContent =
        remaining > 0
          ? `Transfer account expires in ${minutes}:${seconds.toString().padStart(2, "0")}`
          : "Transfer account has expired.";
    };

    update();
    this.countdownTimer = window.setInterval(update, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      window.clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
  }

  private filterChannels(
    channels: PaymentChannel[],
    allowedChannels?: PaymentChannel[],
    payload?: BootstrapPayload,
  ): PaymentChannel[] {
    const unique = [...new Set(channels.map(normalizePaymentChannel))];
    if (allowedChannels?.length) {
      const allowed = allowedChannels.map(normalizePaymentChannel);
      return unique.filter(
        (channel) =>
          allowed.includes(channel) &&
          (payload ? this.isSupported(channel, payload) : true),
      );
    }
    return unique.length > 0 ? unique : ["card", "bank-transfer"];
  }

  private isSupported(
    channel: PaymentChannel,
    payload: BootstrapPayload,
  ): boolean {
    if (channel === "bank-transfer") return true;
    if (channel === "card" || channel === "mono") return true;
    return false;
  }

  private handleClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const close = target.closest<HTMLElement>('[data-action="close"]');
    if (close) {
      this.options.onClose("user");
      return;
    }

    const retry = target.closest<HTMLElement>('[data-action="retry"]');
    if (retry) {
      this.options.onRetry();
      return;
    }

    const refreshStatus = target.closest<HTMLElement>(
      '[data-action="refresh-status"]',
    );
    if (refreshStatus) {
      if (this.selectedChannel)
        this.options.onPaymentStarted(this.selectedChannel);
      this.options.onRefreshStatus();
      return;
    }

    const initialize = target.closest<HTMLElement>(
      '[data-action="initialize-channel"]',
    )?.dataset.channelTarget;
    if (initialize) {
      this.selectedChannel = initialize;
      this.options.onChannelSelected(initialize);
      return;
    }

    const channel =
      target.closest<HTMLElement>("[data-channel]")?.dataset.channel;
    if (channel) {
      const normalized = normalizePaymentChannel(channel);
      this.selectedChannel = normalized;
      this.options.onChannelSelected(normalized);
      return;
    }

    const copy = target.closest<HTMLElement>("[data-copy]")?.dataset.copy;
    if (copy) {
      void navigator.clipboard?.writeText(copy);
      target.textContent = "Copied";
      return;
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      this.options.onClose("user");
      return;
    }

    if (event.key !== "Tab" || this.inline) return;
    const focusable = Array.from(
      this.root.querySelectorAll<HTMLElement>(focusableSelector),
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.root.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusFirst(): void {
    window.setTimeout(() => {
      this.root.querySelector<HTMLElement>(focusableSelector)?.focus();
    }, 0);
  }

  private resolveContainer(): HTMLElement | undefined {
    const container = this.options.container;
    if (!container) return undefined;
    if (container instanceof HTMLElement) return container;
    return document.querySelector<HTMLElement>(container) ?? undefined;
  }
}

function labelForChannel(channel: PaymentChannel): string {
  const labels: Record<string, string> = {
    "bank-transfer": "Bank transfer",
    redirect: "Card",
    card: "Card",
    mono: "Mono",
  };
  return labels[channel] ?? String(channel);
}

function labelForStatus(status?: string): string {
  if (!status) return "Pending confirmation";
  const normalized = String(status).trim();
  if (!normalized) return "Pending confirmation";
  return normalized.replace(/[-_]+/g, " ");
}

function buildCardFrameUrl(payload: BootstrapPayload): string | undefined {
  const transaction = extractTransaction(payload);
  const reference =
    typeof transaction.reference === "string" && transaction.reference.trim()
      ? transaction.reference.trim()
      : typeof payload.reference === "string" && payload.reference.trim()
        ? payload.reference.trim()
        : undefined;
  if (!reference) return undefined;

  const rawAuthorizationUrl = extractAuthorizationUrl(payload);
  if (!rawAuthorizationUrl) return undefined;
  const authorizationUrl = safeUrl(rawAuthorizationUrl);

  const frame = new URL(
    "/sdk/card-frame",
    authorizationUrl ?? "https://checkout.payislands.com",
  );
  frame.searchParams.set("reference", reference);
  if (typeof window !== "undefined" && window.location.origin) {
    frame.searchParams.set("parent_origin", window.location.origin);
  }
  return frame.toString();
}

function sumMoney(amount: unknown, fee: unknown): number | undefined {
  if (amount === undefined || amount === null || amount === "")
    return undefined;
  if (fee === undefined || fee === null || fee === "") return undefined;
  const amountValue = Number(amount);
  const feeValue = Number(fee);
  if (!Number.isFinite(amountValue) || !Number.isFinite(feeValue))
    return undefined;
  return Math.round((amountValue + feeValue) * 100) / 100;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value);
}
