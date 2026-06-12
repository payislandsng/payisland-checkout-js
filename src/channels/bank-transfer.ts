import type { BankTransferPayload } from "../types";

export function getBankTransferFields(details?: BankTransferPayload): {
  accountNumber: string;
  accountName: string;
  bankName: string;
  expiresAt?: string;
} | null {
  const accountNumber = details?.account_number ?? details?.accountNumber;
  if (!accountNumber) return null;

  return {
    accountNumber,
    accountName:
      details?.account_name ?? details?.accountName ?? "PayIsland checkout",
    bankName: details?.bank_name ?? details?.bankName ?? "Bank transfer",
    expiresAt: details?.expires_at ?? details?.expiresAt,
  };
}
