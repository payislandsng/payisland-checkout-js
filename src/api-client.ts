import type {
  ApiResponse,
  BootstrapPayload,
  TransactionPayload,
  VerificationPayload,
} from "./types";
import { CheckoutError, friendlyApiError, getRequestId } from "./utils";

export class ApiClient {
  private readonly baseUrl: string;
  private checkoutToken?: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setCheckoutToken(token?: string): void {
    this.checkoutToken = token;
  }

  async bootstrap(reference: string): Promise<ApiResponse<BootstrapPayload>> {
    return this.request<BootstrapPayload>(
      `/api/v1/transactions/gateway/pay/keys/${reference}`,
      {
        method: "GET",
      },
    );
  }

  async submitPayment(
    reference: string,
    body: Record<string, unknown>,
  ): Promise<ApiResponse<TransactionPayload>> {
    return this.request<TransactionPayload>(
      `/api/v1/transactions/gateway/pay/${reference}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  async verifyOtp(
    reference: string,
    body: Record<string, unknown>,
  ): Promise<ApiResponse<TransactionPayload>> {
    return this.request<TransactionPayload>(
      `/api/v1/transactions/gateway/otp/verify/${reference}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  async verify(reference: string): Promise<ApiResponse<VerificationPayload>> {
    return this.request<VerificationPayload>(
      `/api/v1/transactions/gateway/transaction/verify/${reference}`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
  }

  async verifyBankTransfer(
    reference: string,
  ): Promise<ApiResponse<VerificationPayload>> {
    return this.request<VerificationPayload>(
      `/api/v1/transactions/gateway/transaction/verify-bank-transfer/${reference}`,
      { method: "GET" },
    );
  }

  private async request<T>(
    path: string,
    init: RequestInit,
  ): Promise<ApiResponse<T>> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init.method !== "GET"
            ? { "Content-Type": "application/json" }
            : {}),
          ...(this.checkoutToken
            ? { "x-checkout-token": this.checkoutToken }
            : {}),
          ...init.headers,
        },
        credentials: "omit",
      });
    } catch {
      throw new CheckoutError({
        code: "network_error",
        message:
          "We could not reach PayIsland. Please check your connection and try again.",
      });
    }

    const requestId = getRequestId(response.headers);
    if (!response.ok) {
      throw friendlyApiError(response.status, requestId);
    }

    return {
      data: (await parseJson<T>(response)) ?? ({} as T),
      checkoutToken: response.headers.get("x-checkout-token") ?? undefined,
      requestId,
    };
  }
}

async function parseJson<T>(response: Response): Promise<T | undefined> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined;
  return (await response.json()) as T;
}
