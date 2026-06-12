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
  customer?: CustomerPayload;
  channels?: PaymentChannel[];
  payment_channels?: PaymentChannel[];
  available_channels?: PaymentChannel[];
  bank_transfer?: BankTransferPayload;
  bankTransfer?: BankTransferPayload;
  authorization_url?: string;
  authorizationUrl?: string;
  status?: string;
  amount?: number | string;
  fee?: number | string;
  total_amount?: number | string;
  totalAmount?: number | string;
  currency?: string;
  retry_after_ms?: number;
  poll_interval_ms?: number;
}

export interface TransactionPayload extends Record<string, unknown> {
  reference?: string;
  status?: string;
  amount?: number | string;
  fee?: number | string;
  total_amount?: number | string;
  totalAmount?: number | string;
  currency?: string;
  merchant?: MerchantPayload;
  customer?: CustomerPayload;
  bank_transfer?: BankTransferPayload;
  bankTransfer?: BankTransferPayload;
  authorization_url?: string;
  authorizationUrl?: string;
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
  logo?: string;
  logo_url?: string;
}

export interface CustomerPayload {
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface BankTransferPayload {
  account_number?: string;
  accountNumber?: string;
  account_name?: string;
  accountName?: string;
  bank_name?: string;
  bankName?: string;
  expires_at?: string;
  expiresAt?: string;
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
