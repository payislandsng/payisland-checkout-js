export type PaymentChannel =
  | "card"
  | "bank-transfer"
  | "mono"
  | "redirect"
  | string;

export type NormalizedStatus =
  | "idle"
  | "loading"
  | "ready"
  | "pending"
  | "success"
  | "failed"
  | "expired"
  | "closed";

export interface CheckoutTheme {
  primaryColor?: string;
  logoUrl?: string;
  merchantName?: string;
}

export interface PayIslandCheckoutOptions {
  reference: string;
  container?: HTMLElement | string;
  channels?: PaymentChannel[];
  theme?: CheckoutTheme;
  onSuccess?: (transaction: TransactionPayload) => void;
  onPending?: (status: VerificationPayload) => void;
  onError?: (error: CheckoutErrorPayload) => void;
  onClose?: () => void;
  __apiBaseUrl?: string;
  __receiptBaseUrl?: string;
  __navigate?: (url: string) => void;
}

export interface CheckoutErrorPayload {
  code: string;
  message: string;
  status?: number;
  requestId?: string;
}

export interface ApiResponse<T> {
  data: T;
  checkoutToken?: string;
  requestId?: string;
}

export interface BootstrapPayload {
  reference?: string;
  transaction?: TransactionPayload;
  data?: TransactionPayload;
  merchant?: MerchantPayload;
  business?: MerchantPayload;
  customer?: CustomerPayload;
  channels?: PaymentChannel[];
  payment_channels?: PaymentChannel[];
  available_channels?: PaymentChannel[];
  bank_transfer?: BankTransferPayload;
  bankTransfer?: BankTransferPayload;
  authorization_url?: string;
  authorizationUrl?: string;
  status?: string;
  payment_status?: string;
  amount?: number | string;
  fee?: number | string;
  transaction_fee?: number | string;
  total_amount?: number | string;
  totalAmount?: number | string;
  amount_to_be_paid?: number | string;
  amountToBePaid?: number | string;
  currency?: string;
  business_name?: string;
  merchant_name?: string;
  business_logo?: string;
  merchant_logo?: string;
  retry_after_ms?: number;
  poll_interval_ms?: number;
}

export interface TransactionPayload extends Record<string, unknown> {
  reference?: string;
  status?: string;
  payment_status?: string;
  amount?: number | string;
  fee?: number | string;
  transaction_fee?: number | string;
  total_amount?: number | string;
  totalAmount?: number | string;
  amount_to_be_paid?: number | string;
  amountToBePaid?: number | string;
  currency?: string;
  merchant?: MerchantPayload;
  business?: MerchantPayload;
  customer?: CustomerPayload;
  bank_transfer?: BankTransferPayload;
  bankTransfer?: BankTransferPayload;
  authorization_url?: string;
  authorizationUrl?: string;
  business_name?: string;
  merchant_name?: string;
  business_logo?: string;
  merchant_logo?: string;
  retry_after_ms?: number;
  poll_interval_ms?: number;
}

export interface VerificationPayload extends Record<string, unknown> {
  status?: string;
  transaction?: TransactionPayload;
  data?: TransactionPayload;
  retry_after_ms?: number;
  poll_interval_ms?: number;
}

export interface MerchantPayload {
  name?: string;
  business_name?: string;
  merchant_name?: string;
  logo?: string;
  logo_url?: string;
  business_logo?: string;
  merchant_logo?: string;
}

export interface CustomerPayload {
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface BankTransferPayload extends Record<string, unknown> {
  account_number?: string;
  accountNumber?: string;
  account_no?: string;
  accountNo?: string;
  account_name?: string;
  accountName?: string;
  name?: string;
  bank_name?: string;
  bankName?: string;
  bank?: string | { name?: string; bank_name?: string; bankName?: string };
  expires_at?: string;
  expiresAt?: string;
  expiry_date?: string;
  expiryDate?: string;
  amount?: number | string;
}

export interface CheckoutContext {
  reference: string;
  theme: CheckoutTheme;
  bootstrap?: BootstrapPayload;
  checkoutToken?: string;
  selectedChannel?: PaymentChannel;
  status: NormalizedStatus;
  error?: CheckoutErrorPayload;
}
