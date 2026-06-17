import type { BankTransferPayload, BootstrapPayload, CheckoutErrorPayload, CustomerPayload, MerchantPayload, PaymentChannel, TransactionPayload, VerificationPayload } from "./types";
export declare class CheckoutError extends Error {
    code: string;
    status?: number;
    requestId?: string;
    constructor(payload: CheckoutErrorPayload);
    toPayload(): CheckoutErrorPayload;
}
export declare function validateReference(reference: unknown): string;
export declare function resolveApiBaseUrl(override?: string): string;
export declare function getRequestId(headers: Headers): string | undefined;
export declare function normalizeStatus(raw: unknown): "success" | "failed" | "expired" | "pending" | "unknown";
export declare function extractTransaction(payload?: BootstrapPayload | VerificationPayload): TransactionPayload;
export declare function extractStatus(payload?: BootstrapPayload | VerificationPayload): string | undefined;
export declare function extractChannels(payload?: BootstrapPayload): PaymentChannel[];
export declare function extractMerchant(payload?: BootstrapPayload): MerchantPayload;
export declare function extractCustomer(payload?: BootstrapPayload): CustomerPayload;
export declare function extractBankTransfer(payload?: BootstrapPayload | TransactionPayload): BankTransferPayload | undefined;
export declare function extractAuthorizationUrl(payload?: BootstrapPayload | TransactionPayload): string | undefined;
export declare function getPollDelay(payload?: BootstrapPayload | VerificationPayload, fallback?: number): number;
export declare function formatMoney(amount: unknown, currency?: string): string;
export declare function maskEmail(email?: string): string;
export declare function customerDisplayName(customer: CustomerPayload): string;
export declare function merchantDisplayName(merchant: MerchantPayload, fallback?: string): string;
export declare function logoUrl(merchant: MerchantPayload, fallback?: string): string | undefined;
export declare function safeUrl(value?: string): string | undefined;
export declare function isElement(value: unknown): value is HTMLElement;
export declare function friendlyApiError(status: number, requestId?: string): CheckoutError;
