import type { BankTransferPayload } from "../types";

export function getBankTransferFields(details?: BankTransferPayload): {
  accountNumber: string;
  accountName: string;
  bankName: string;
  expiresAt?: string;
} | null {
  const account = details?.account;
  const accountRecord =
    account && typeof account === "object"
      ? (account as Record<string, unknown>)
      : undefined;
  const bank =
    details?.bank && typeof details.bank === "object"
      ? details.bank
      : undefined;
  const accountNumber =
    details?.account_number ??
    details?.accountNumber ??
    details?.account_no ??
    details?.accountNo ??
    stringValue(accountRecord?.number) ??
    stringValue(accountRecord?.account_number) ??
    stringValue(accountRecord?.accountNumber);
  if (!accountNumber) return null;

  return {
    accountNumber,
    accountName:
      details?.account_name ??
      details?.accountName ??
      details?.name ??
      stringValue(accountRecord?.name) ??
      stringValue(accountRecord?.account_name) ??
      stringValue(accountRecord?.accountName) ??
      "PayIsland checkout",
    bankName:
      details?.bank_name ??
      details?.bankName ??
      (typeof details?.bank === "string" ? details.bank : undefined) ??
      bank?.name ??
      bank?.bank_name ??
      bank?.bankName ??
      "Bank transfer",
    expiresAt: details?.expires_at ?? details?.expiresAt,
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
