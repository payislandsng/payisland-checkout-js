import type { ApiResponse, BootstrapPayload, TransactionPayload, VerificationPayload } from "./types";
export declare class ApiClient {
    private readonly baseUrl;
    private checkoutToken?;
    constructor(baseUrl: string);
    setCheckoutToken(token?: string): void;
    bootstrap(reference: string): Promise<ApiResponse<BootstrapPayload>>;
    submitPayment(reference: string, body: Record<string, unknown>): Promise<ApiResponse<TransactionPayload>>;
    verifyOtp(reference: string, body: Record<string, unknown>): Promise<ApiResponse<TransactionPayload>>;
    verify(reference: string): Promise<ApiResponse<VerificationPayload>>;
    verifyBankTransfer(reference: string): Promise<ApiResponse<VerificationPayload>>;
    private request;
}
