import { describe, expect, it, vi } from "vitest";
import { close, open } from "../src";
import { safeUrl } from "../src/utils";

function mockJson(
  body: unknown,
  headers: Record<string, string> = {},
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

function fetchMock(...responses: Response[]): ReturnType<typeof vi.fn> {
  const mock = vi.fn();
  responses.forEach((response) => mock.mockResolvedValueOnce(response));
  mock.mockResolvedValue(
    mockJson({ status: "pending", poll_interval_ms: 1000 }),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

function shadowText(): string {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-payisland-checkout]"),
  )
    .map((host) => host.shadowRoot?.textContent ?? "")
    .join(" ");
}

function shadowButton(label: string): HTMLButtonElement {
  const buttons = Array.from(
    document.querySelectorAll<HTMLElement>("[data-payisland-checkout]"),
  ).flatMap((host) =>
    Array.from(host.shadowRoot?.querySelectorAll("button") ?? []),
  );
  const button = buttons.find((item) => item.textContent?.includes(label));
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

describe("PayIslandCheckout", () => {
  it("validates reference before bootstrapping", () => {
    const onError = vi.fn();
    const fetch = fetchMock(mockJson({}));

    open({ reference: "bad ref!", onError });

    expect(fetch).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "invalid_reference",
      }),
    );
  });

  it("opens and closes the modal", async () => {
    fetchMock(mockJson({ reference: "PIST2605220000000117", amount: 1000 }));
    const onClose = vi.fn();

    open({ reference: "PIST2605220000000117", onClose });

    await vi.waitFor(() => {
      expect(document.querySelector("[data-payisland-checkout]")).toBeTruthy();
    });

    close();

    expect(document.querySelector("[data-payisland-checkout]")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls the bootstrap endpoint", async () => {
    const fetch = fetchMock(
      mockJson({ reference: "PIST2605220000000117", amount: 1000 }),
    );

    open({ reference: "PIST2605220000000117" });

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "https://ags.payislands.com/api/v1/transactions/gateway/pay/keys/PIST2605220000000117",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  it("reads x-checkout-token from bootstrap headers and sends it during verification", async () => {
    vi.useFakeTimers();
    const fetch = fetchMock(
      mockJson(
        {
          reference: "PIST2605220000000117",
          status: "pending",
          poll_interval_ms: 1000,
        },
        { "x-checkout-token": "checkout-token-value" },
      ),
      mockJson({ status: "pending", poll_interval_ms: 1000 }),
    );

    open({ reference: "PIST2605220000000117" });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    expect(fetch.mock.calls[1][1].headers).toMatchObject({
      "x-checkout-token": "checkout-token-value",
    });
  });

  it("calls onSuccess once for a successful terminal state", async () => {
    vi.useFakeTimers();
    const onSuccess = vi.fn();
    fetchMock(
      mockJson({
        reference: "PIST2605220000000117",
        status: "pending",
        poll_interval_ms: 1000,
      }),
      mockJson({
        status: "success",
        transaction: { reference: "PIST2605220000000117", status: "success" },
      }),
      mockJson({
        status: "success",
        transaction: { reference: "PIST2605220000000117", status: "success" },
      }),
    );

    open({ reference: "PIST2605220000000117", onSuccess });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(5000);

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("calls onError for a failed terminal state", async () => {
    const onError = vi.fn();
    fetchMock(
      mockJson({ reference: "PIST2605220000000117", status: "failed" }),
    );

    open({ reference: "PIST2605220000000117", onError });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "payment_failed",
        }),
      );
    });
  });

  it("reports pending state while polling", async () => {
    vi.useFakeTimers();
    const onPending = vi.fn();
    fetchMock(
      mockJson({
        reference: "PIST2605220000000117",
        status: "pending",
        poll_interval_ms: 1000,
      }),
      mockJson({ status: "pending", poll_interval_ms: 1000 }),
    );

    open({ reference: "PIST2605220000000117", onPending });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(onPending).toHaveBeenCalled());
  });

  it("clears the polling timer when closed", async () => {
    vi.useFakeTimers();
    const fetch = fetchMock(
      mockJson({
        reference: "PIST2605220000000117",
        status: "pending",
        poll_interval_ms: 1000,
      }),
      mockJson({ status: "pending" }),
    );

    open({ reference: "PIST2605220000000117" });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    close(false);
    await vi.advanceTimersByTimeAsync(3000);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("renders bank transfer details", async () => {
    fetchMock(
      mockJson({
        reference: "PIST2605220000000117",
        amount: 1000,
        fee: 50,
        total_amount: 1050,
        bank_transfer: {
          account_number: "1234567890",
          account_name: "PayIsland Test",
          bank_name: "PayIsland Bank",
        },
      }),
    );

    open({ reference: "PIST2605220000000117" });

    await vi.waitFor(() => {
      expect(shadowText()).toContain("1234567890");
      expect(shadowText()).toContain("PayIsland Bank");
    });
  });

  it("respects the merchant channel allow-list", async () => {
    fetchMock(
      mockJson({
        reference: "PIST2605220000000117",
        channels: ["bank-transfer", "redirect"],
        bank_transfer: {
          account_number: "1234567890",
          account_name: "PayIsland Test",
          bank_name: "PayIsland Bank",
        },
        authorization_url: "https://checkout.payislands.com/pay",
      }),
    );

    open({
      reference: "PIST2605220000000117",
      channels: ["redirect"],
    });

    await vi.waitFor(() => {
      expect(shadowText()).toContain("Continue to payment");
      expect(shadowText()).not.toContain("1234567890");
      expect(shadowText()).not.toContain("Bank transfer");
    });
  });

  it("does not fall back to default channels when a restrictive allow-list has no available match", async () => {
    const onError = vi.fn();
    fetchMock(
      mockJson({
        reference: "PIST2605220000000117",
        channels: ["bank-transfer"],
        bank_transfer: {
          account_number: "1234567890",
          account_name: "PayIsland Test",
          bank_name: "PayIsland Bank",
        },
      }),
    );

    open({
      reference: "PIST2605220000000117",
      channels: ["card"],
      onError,
    });

    await vi.waitFor(() => {
      expect(shadowText()).toContain(
        "No available payment channels for this checkout.",
      );
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: "no_available_channels" }),
      );
      expect(shadowText()).not.toContain("Card payments are not available");
      expect(shadowText()).not.toContain("1234567890");
    });
  });

  it("cleans up validation error UI when close is called", () => {
    open({ reference: "bad ref!" });

    expect(document.querySelector("[data-payisland-checkout]")).toBeTruthy();
    expect(shadowText()).toContain("unsupported characters");
    expect(shadowText()).not.toContain("Retry");

    close(false);

    expect(document.querySelector("[data-payisland-checkout]")).toBeNull();
  });

  it("keeps bank transfer details visible while pending", async () => {
    vi.useFakeTimers();
    const onPending = vi.fn();
    fetchMock(
      mockJson({
        reference: "PIST2605220000000117",
        status: "pending",
        amount: 1000,
        total_amount: 1000,
        poll_interval_ms: 1000,
        bank_transfer: {
          account_number: "1234567890",
          account_name: "PayIsland Test",
          bank_name: "PayIsland Bank",
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      }),
      mockJson({ status: "pending", poll_interval_ms: 1000 }),
    );

    open({ reference: "PIST2605220000000117", onPending });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(onPending).toHaveBeenCalled());

    expect(shadowText()).toContain("1234567890");
    expect(shadowText()).toContain("PayIsland Test");
    expect(shadowText()).toContain("PayIsland Bank");
    expect(shadowText()).toContain("Current status");
    expect(shadowText()).toContain("Refresh status");
  });

  it("uses bank transfer verification while bank transfer is selected", async () => {
    vi.useFakeTimers();
    const fetch = fetchMock(
      mockJson({
        reference: "PIST2605220000000117",
        status: "pending",
        poll_interval_ms: 1000,
        bank_transfer: {
          account_number: "1234567890",
          account_name: "PayIsland Test",
          bank_name: "PayIsland Bank",
        },
      }),
      mockJson({ status: "pending", poll_interval_ms: 1000 }),
    );

    open({ reference: "PIST2605220000000117" });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    expect(String(fetch.mock.calls[1][0])).toContain(
      "/transaction/verify-bank-transfer/PIST2605220000000117",
    );
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "GET" });
  });

  it("requires HTTPS for payment redirects except local development URLs", async () => {
    expect(safeUrl("https://checkout.payislands.com/pay")).toBe(
      "https://checkout.payislands.com/pay",
    );
    expect(safeUrl("http://localhost:5173/pay")).toBe(
      "http://localhost:5173/pay",
    );
    expect(safeUrl("http://127.0.0.1:5173/pay")).toBe(
      "http://127.0.0.1:5173/pay",
    );
    expect(safeUrl("http://checkout.payislands.com/pay")).toBeUndefined();

    const openWindow = vi.fn();
    vi.stubGlobal("open", openWindow);
    fetchMock(
      mockJson({
        reference: "PIST2605220000000117",
        authorization_url: "http://checkout.payislands.com/pay",
      }),
    );

    open({ reference: "PIST2605220000000117" });

    await vi.waitFor(() => {
      const button = shadowButton("Continue to payment");
      expect(button.disabled).toBe(true);
    });
    shadowButton("Continue to payment").click();

    expect(openWindow).not.toHaveBeenCalled();
  });

  it("handles expired status as a terminal state and stops polling", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const fetch = fetchMock(
      mockJson({
        reference: "PIST2605220000000117",
        status: "pending",
        poll_interval_ms: 1000,
      }),
      mockJson({ status: "expired", poll_interval_ms: 1000 }),
      mockJson({ status: "pending", poll_interval_ms: 1000 }),
    );

    open({ reference: "PIST2605220000000117", onError });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: "payment_expired" }),
      );
    });
    await vi.advanceTimersByTimeAsync(5000);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(shadowText()).toContain("This checkout has expired");
  });

  it("manual bank transfer refresh does not create duplicate polling timers", async () => {
    vi.useFakeTimers();
    const fetch = fetchMock(
      mockJson({
        reference: "PIST2605220000000117",
        status: "pending",
        poll_interval_ms: 1000,
        bank_transfer: {
          account_number: "1234567890",
          account_name: "PayIsland Test",
          bank_name: "PayIsland Bank",
        },
      }),
      mockJson({ status: "pending", poll_interval_ms: 1000 }),
      mockJson({ status: "pending", poll_interval_ms: 1000 }),
    );

    open({ reference: "PIST2605220000000117" });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(shadowText()).toContain("Refresh status"));
    shadowButton("Refresh status").click();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));

    await vi.advanceTimersByTimeAsync(10);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
