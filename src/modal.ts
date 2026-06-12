import { getBankTransferFields } from "./channels/bank-transfer";
import { cardUnavailableMessage } from "./channels/card-placeholder";
import { openRedirect } from "./channels/redirect";
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
  logoUrl,
  maskEmail,
  merchantDisplayName,
} from "./utils";

type CloseReason = "user" | "programmatic";

interface ModalOptions {
  container?: HTMLElement | string;
  theme: CheckoutTheme;
  onClose: (reason: CloseReason) => void;
  onRetry: () => void;
  onChannelSelected: (channel: PaymentChannel) => void;
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
      <div class="pi-state" role="status" aria-live="polite">
        <div class="pi-spinner" aria-hidden="true"></div>
        <p class="pi-message">Preparing secure checkout...</p>
      </div>
    `);
  }

  renderError(error: CheckoutErrorPayload): void {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state" role="alert">
        <div class="pi-badge pi-badge-error" aria-hidden="true">!</div>
        <p class="pi-message">${escapeHtml(error.message)}</p>
        <button class="pi-secondary" type="button" data-action="retry">Retry</button>
      </div>
    `);
  }

  renderCheckout(
    payload: BootstrapPayload,
    allowedChannels?: PaymentChannel[],
  ): void {
    const channels = this.filterChannels(
      extractChannels(payload),
      allowedChannels,
    );
    this.selectedChannel =
      this.selectedChannel && channels.includes(this.selectedChannel)
        ? this.selectedChannel
        : (channels.find((channel) => this.isSupported(channel, payload)) ??
          channels[0]);

    this.setBody(`
      <div class="pi-stack">
        ${this.renderSummary(payload)}
        ${this.renderTabs(channels, payload)}
        <div class="pi-panel">${this.renderChannel(payload, this.selectedChannel)}</div>
      </div>
    `);

    this.startCountdown(payload);
  }

  renderPending(payload?: VerificationPayload): void {
    this.setBody(`
      <div class="pi-state" role="status" aria-live="polite">
        <div class="pi-spinner" aria-hidden="true"></div>
        <p class="pi-message">Payment is pending. We are checking for confirmation.</p>
        ${payload?.status ? `<p class="pi-subtitle">Status: ${escapeHtml(payload.status)}</p>` : ""}
      </div>
    `);
  }

  renderSuccess(): void {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state" role="status" aria-live="polite">
        <div class="pi-badge pi-badge-success" aria-hidden="true">✓</div>
        <p class="pi-message">Payment successful.</p>
      </div>
    `);
  }

  renderFailure(message: string): void {
    this.stopCountdown();
    this.setBody(`
      <div class="pi-state" role="alert">
        <div class="pi-badge pi-badge-error" aria-hidden="true">!</div>
        <p class="pi-message">${escapeHtml(message)}</p>
      </div>
    `);
  }

  private renderShell(): void {
    const merchantName =
      this.options.theme.merchantName ?? "PayIsland Checkout";
    const logo = this.options.theme.logoUrl;
    const wrapperClass = this.inline ? "pi-inline" : "pi-overlay";

    this.root.innerHTML = `
      <style>${styles}</style>
      <div class="${wrapperClass}" data-shell>
        <section class="pi-modal" role="dialog" aria-modal="${this.inline ? "false" : "true"}" aria-labelledby="pi-title">
          <header class="pi-header">
            <div class="pi-brand">
              ${
                logo
                  ? `<img class="pi-logo" src="${escapeAttr(logo)}" alt="" />`
                  : `<div class="pi-logo-fallback" aria-hidden="true">PI</div>`
              }
              <div>
                <h2 class="pi-title" id="pi-title">${escapeHtml(merchantName)}</h2>
                <p class="pi-subtitle">Secure PayIsland checkout</p>
              </div>
            </div>
            <button class="pi-close" type="button" aria-label="Close checkout" data-action="close">×</button>
          </header>
          <main class="pi-body" data-body></main>
          <footer class="pi-footer">
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
      payload.total_amount ??
      payload.totalAmount;
    const amount = transaction.amount ?? payload.amount;
    const fee = transaction.fee ?? payload.fee;
    const customerName = customerDisplayName(customer);
    const customerEmail = maskEmail(customer.email);
    const merchantLogo = logoUrl(merchant, this.options.theme.logoUrl);

    return `
      <section class="pi-summary" aria-label="Transaction summary">
        <div class="pi-brand">
          ${
            merchantLogo
              ? `<img class="pi-logo" src="${escapeAttr(merchantLogo)}" alt="" />`
              : `<div class="pi-logo-fallback" aria-hidden="true">PI</div>`
          }
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
  ): string {
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
        </section>
      `;
    }

    if (channel === "redirect" || extractAuthorizationUrl(payload)) {
      const url = extractAuthorizationUrl(payload);
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
  ): PaymentChannel[] {
    const unique = [...new Set(channels)];
    const filtered = allowedChannels?.length
      ? unique.filter((channel) => allowedChannels.includes(channel))
      : unique;
    return filtered.length > 0
      ? filtered
      : ["bank-transfer", "redirect", "card"];
  }

  private isSupported(
    channel: PaymentChannel,
    payload: BootstrapPayload,
  ): boolean {
    if (channel === "bank-transfer")
      return Boolean(extractBankTransfer(payload));
    if (channel === "redirect")
      return Boolean(extractAuthorizationUrl(payload));
    return channel === "card" ? false : false;
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

    const channel =
      target.closest<HTMLElement>("[data-channel]")?.dataset.channel;
    if (channel) {
      this.selectedChannel = channel;
      this.options.onChannelSelected(channel);
      return;
    }

    const copy = target.closest<HTMLElement>("[data-copy]")?.dataset.copy;
    if (copy) {
      void navigator.clipboard?.writeText(copy);
      target.textContent = "Copied";
      return;
    }

    const redirect =
      target.closest<HTMLElement>("[data-redirect]")?.dataset.redirect;
    if (redirect) openRedirect(redirect);
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
    redirect: "Redirect",
    card: "Card",
    mono: "Mono",
  };
  return labels[channel] ?? String(channel);
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
