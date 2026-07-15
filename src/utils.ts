import type {
  BankTransferPayload,
  BootstrapPayload,
  CheckoutErrorPayload,
  CustomerPayload,
  MerchantPayload,
  PaymentChannel,
  TransactionPayload,
  VerificationPayload,
} from "./types";

const PRODUCTION_API_BASE = "https://ags.payislands.com";
const TERMINAL_SUCCESS = new Set(["paid", "successful", "success"]);
const TERMINAL_FAILURE = new Set([
  "failed",
  "canceled",
  "cancelled",
  "reversed",
]);
const EXPIRED = new Set(["expired"]);
const PENDING = new Set(["pending", "unpaid", "processing", "initiated"]);

export class CheckoutError extends Error {
  code: string;
  status?: number;
  requestId?: string;

  constructor(payload: CheckoutErrorPayload) {
    super(payload.message);
    this.name = "CheckoutError";
    this.code = payload.code;
    this.status = payload.status;
    this.requestId = payload.requestId;
  }

  toPayload(): CheckoutErrorPayload {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      requestId: this.requestId,
    };
  }
}

export function validateReference(reference: unknown): string {
  if (typeof reference !== "string" || reference.trim().length < 6) {
    throw new CheckoutError({
      code: "invalid_reference",
      message: "Enter a valid PayIsland transaction reference.",
    });
  }

  const normalized = reference.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new CheckoutError({
      code: "invalid_reference",
      message:
        "The PayIsland transaction reference contains unsupported characters.",
    });
  }

  return normalized;
}

export function resolveApiBaseUrl(override?: string): string {
  if (!override) return PRODUCTION_API_BASE;

  const currentHost = window.location.hostname;
  const allowedHost = ["localhost", "127.0.0.1", "::1"].includes(currentHost);
  if (!allowedHost) {
    throw new CheckoutError({
      code: "api_base_not_allowed",
      message:
        "API base overrides are only available for local development and testing.",
    });
  }

  return override.replace(/\/+$/, "");
}

export function getRequestId(headers: Headers): string | undefined {
  return (
    headers.get("x-request-id") ??
    headers.get("x-correlation-id") ??
    headers.get("x-trace-id") ??
    undefined
  );
}

export function normalizeStatus(
  raw: unknown,
): "success" | "failed" | "expired" | "pending" | "unknown" {
  const status = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (TERMINAL_SUCCESS.has(status)) return "success";
  if (EXPIRED.has(status)) return "expired";
  if (TERMINAL_FAILURE.has(status)) return "failed";
  if (PENDING.has(status)) return "pending";
  return "unknown";
}

export function extractTransaction(
  payload?: BootstrapPayload | VerificationPayload,
): TransactionPayload {
  if (!payload) return {};
  const maybeData = "data" in payload ? payload.data : undefined;
  const maybeTransaction =
    "transaction" in payload ? payload.transaction : undefined;
  return maybeTransaction ?? maybeData ?? (payload as TransactionPayload);
}

export function extractStatus(
  payload?: BootstrapPayload | VerificationPayload,
): string | undefined {
  const transaction = extractTransaction(payload);
  const payloadStatus =
    typeof payload?.status === "string" ? payload.status : undefined;
  return transaction.status ?? transaction.payment_status ?? payloadStatus;
}

export function extractChannels(payload?: BootstrapPayload): PaymentChannel[] {
  const transaction = extractTransaction(payload);
  const candidates =
    payload?.channels ??
    payload?.payment_channels ??
    payload?.available_channels ??
    (transaction.channels as PaymentChannel[] | undefined);

  if (Array.isArray(candidates) && candidates.length > 0) {
    return candidates.filter(
      (channel): channel is PaymentChannel => typeof channel === "string",
    );
  }

  const channels: PaymentChannel[] = [];
  if (extractBankTransfer(payload)) channels.push("bank-transfer");
  if (extractAuthorizationUrl(payload)) channels.push("redirect");
  return channels.length > 0 ? channels : ["bank-transfer", "redirect", "card"];
}

export function extractMerchant(payload?: BootstrapPayload): MerchantPayload {
  const transaction = extractTransaction(payload);
  const business =
    payload?.business ?? transaction.business ?? ({} as MerchantPayload);
  return (
    payload?.merchant ??
    transaction.merchant ?? {
      business_name:
        payload?.business_name ??
        transaction.business_name ??
        payload?.merchant_name ??
        transaction.merchant_name ??
        business.business_name ??
        business.merchant_name ??
        business.name,
      name:
        payload?.merchant_name ??
        transaction.merchant_name ??
        business.name ??
        business.business_name,
      logo:
        payload?.business_logo ??
        payload?.merchant_logo ??
        transaction.business_logo ??
        transaction.merchant_logo ??
        business.business_logo ??
        business.merchant_logo ??
        business.logo_url ??
        business.logo,
    }
  );
}

export function extractCustomer(payload?: BootstrapPayload): CustomerPayload {
  const transaction = extractTransaction(payload);
  return payload?.customer ?? transaction.customer ?? {};
}

export function extractBankTransfer(
  payload?: BootstrapPayload | TransactionPayload,
): BankTransferPayload | undefined {
  if (!payload) return undefined;

  const direct = bankTransferCandidate(payload);
  if (direct) return direct;

  const transaction = extractTransaction(payload);
  if (transaction !== payload) return bankTransferCandidate(transaction);

  return undefined;
}

export function extractAuthorizationUrl(
  payload?: BootstrapPayload | TransactionPayload,
): string | undefined {
  if (!payload) return undefined;

  const direct = payload.authorization_url ?? payload.authorizationUrl;
  if (direct) return direct;

  const transaction = extractTransaction(payload);
  if (transaction !== payload)
    return transaction.authorization_url ?? transaction.authorizationUrl;

  return undefined;
}

export function getPollDelay(
  payload?: BootstrapPayload | VerificationPayload,
  fallback = 5000,
): number {
  const retryAfter = payload?.retry_after_ms;
  const pollInterval = payload?.poll_interval_ms;
  const value = typeof retryAfter === "number" ? retryAfter : pollInterval;
  if (!value || value < 1000) return fallback;
  return Math.min(value, 60000);
}

export function formatMoney(amount: unknown, currency = "NGN"): string {
  if (amount === undefined || amount === null || amount === "") return "--";
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function maskEmail(email?: string): string {
  if (!email) return "";
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(name.length - 2, 2))}@${domain}`;
}

export function customerDisplayName(customer: CustomerPayload): string {
  const name =
    customer.name ??
    [customer.first_name, customer.last_name].filter(Boolean).join(" ");
  return name.trim();
}

export function merchantDisplayName(
  merchant: MerchantPayload,
  fallback?: string,
): string {
  return (
    merchant.business_name ??
    merchant.merchant_name ??
    merchant.name ??
    fallback ??
    "PayIsland merchant"
  );
}

export function logoUrl(
  merchant: MerchantPayload,
  fallback?: string,
): string | undefined {
  return (
    fallback ??
    merchant.logo_url ??
    merchant.business_logo ??
    merchant.merchant_logo ??
    merchant.logo
  );
}

export function safeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.toString();
    if (url.protocol === "http:" && isLocalHost(url.hostname))
      return url.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

function bankTransferCandidate(
  payload: BootstrapPayload | TransactionPayload,
): BankTransferPayload | undefined {
  const record = payload as Record<string, unknown>;
  const candidates = [
    payload.bank_transfer,
    payload.bankTransfer,
    record.bank_account,
    record.bankAccount,
    record.virtual_account,
    record.virtualAccount,
    record.transfer_account,
    record.transferAccount,
    record.account_details,
    record.accountDetails,
  ];

  const nested = candidates.find(isBankTransferPayload);
  if (nested) return nested;

  return isBankTransferPayload(payload) ? payload : undefined;
}

function isBankTransferPayload(value: unknown): value is BankTransferPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Boolean(
    record.account_number ??
    record.accountNumber ??
    record.account_no ??
    record.accountNo ??
    (record.account &&
      typeof record.account === "object" &&
      ((record.account as Record<string, unknown>).number ??
        (record.account as Record<string, unknown>).account_number ??
        (record.account as Record<string, unknown>).accountNumber)),
  );
}

export function isElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

export function friendlyApiError(
  status: number,
  requestId?: string,
): CheckoutError {
  if (status === 404) {
    return new CheckoutError({
      code: "reference_not_found",
      message: "This checkout link is invalid or has expired.",
      status,
      requestId,
    });
  }

  if (status >= 400 && status < 500) {
    return new CheckoutError({
      code: "validation_error",
      message:
        "We could not continue with this checkout. Please confirm the payment details.",
      status,
      requestId,
    });
  }

  return new CheckoutError({
    code: "network_error",
    message:
      "We could not reach PayIsland. Please check your connection and try again.",
    status,
    requestId,
  });
}
