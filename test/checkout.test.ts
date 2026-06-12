import { describe, expect, it, vi } from "vitest";
import { close, open } from "../src";

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
});
