import type { BankTransferPayload } from "../types";
export declare function getBankTransferFields(details?: BankTransferPayload): {
    accountNumber: string;
    accountName: string;
    bankName: string;
    expiresAt?: string;
} | null;
