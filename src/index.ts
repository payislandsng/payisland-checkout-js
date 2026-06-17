import { ApiClient } from "./api-client";
import { CheckoutModal } from "./modal";
import { VerificationPoller } from "./polling";
import { CheckoutStateMachine } from "./state-machine";
import type {
  BootstrapPayload,
  CheckoutErrorPayload,
  PayIslandCheckoutOptions,
  TransactionPayload,
  VerificationPayload,
} from "./types";
import {
  CheckoutError,
  extractBankTransfer,
  extractStatus,
  extractTransaction,
  getPollDelay,
  normalizeStatus,
  resolveApiBaseUrl,
  validateReference,
} from "./utils";

export type {
  PayIslandCheckoutOptions,
  CheckoutErrorPayload,
  TransactionPayload,
  VerificationPayload,
};

interface ActiveCheckout {
  options: PayIslandCheckoutOptions;
  reference: string;
  api?: ApiClient;
  modal: CheckoutModal;
  poller: VerificationPoller;
  machine: CheckoutStateMachine;
  bootstrap?: BootstrapPayload;
  successCalled: boolean;
  errorCalled: boolean;
  closeCalled: boolean;
}

let active: ActiveCheckout | undefined;

export function open(options: PayIslandCheckoutOptions): void {
  close(false);

  let reference: string;
  try {
    reference = validateReference(options?.reference);
  } catch (error) {
    const payload = toErrorPayload(error);
    options?.onError?.(payload);
    renderValidationError(options, payload);
    return;
  }

  let api: ApiClient;
  try {
    api = new ApiClient(resolveApiBaseUrl(options.__apiBaseUrl));
  } catch (error) {
    const payload = toErrorPayload(error);
    options.onError?.(payload);
    renderValidationError(options, payload);
    return;
  }

  const machine = new CheckoutStateMachine({
    reference,
    theme: options.theme ?? {},
    status: "idle",
  });
  const poller = new VerificationPoller();
  const modal = new CheckoutModal({
    container: options.container,
    theme: options.theme ?? {},
    onClose: (reason) => close(reason === "user"),
    onRetry: () => void bootstrapActive(),
    onChannelSelected: () => {
      if (active?.bootstrap)
        active.modal.renderCheckout(
          active.bootstrap,
          active.options.channels,
          active.machine.context.status,
        );
    },
    onRefreshStatus: () => void refreshActiveStatus(),
  });

  active = {
    options,
    reference,
    api,
    modal,
    poller,
    machine,
    successCalled: false,
    errorCalled: false,
    closeCalled: false,
  };

  modal.mount();
  void bootstrapActive();
}

export function close(callCallback = true): void {
  if (!active) return;

  const checkout = active;
  active = undefined;
  checkout.poller.stop();
  checkout.machine.send({ type: "CLOSE" });
  checkout.modal.destroy();
  checkout.api?.setCheckoutToken(undefined);
  checkout.bootstrap = undefined;

  if (callCallback && !checkout.closeCalled) {
    checkout.closeCalled = true;
    checkout.options.onClose?.();
  }
}

async function bootstrapActive(): Promise<void> {
  const checkout = active;
  if (!checkout || !checkout.api) return;

  checkout.poller.stop();
  checkout.machine.send({ type: "LOAD" });
  checkout.modal.renderLoading();

  try {
    const response = await checkout.api.bootstrap(checkout.reference);
    if (active !== checkout) return;

    checkout.bootstrap = response.data;
    checkout.machine.context.bootstrap = response.data;
    checkout.machine.context.checkoutToken = response.checkoutToken;
    checkout.api.setCheckoutToken(response.checkoutToken);

    const hasAvailableChannel = checkout.modal.renderCheckout(
      response.data,
      checkout.options.channels,
    );
    if (!hasAvailableChannel) {
      checkout.machine.send({ type: "FAIL" });
      callErrorOnce({
        code: "no_available_channels",
        message: "No available payment channels for this checkout.",
      });
      return;
    }

    handlePayload(response.data, false);

    const status = normalizeStatus(extractStatus(response.data));
    if (status === "unknown" || status === "pending") {
      startPolling(getPollDelay(response.data));
    }
  } catch (error) {
    if (active !== checkout) return;
    const payload = toErrorPayload(error);
    checkout.machine.context.error = payload;
    checkout.machine.send({ type: "FAIL" });
    checkout.modal.renderError(payload);
    callErrorOnce(payload);
  }
}

function startPolling(delay: number): void {
  const checkout = active;
  if (!checkout || !checkout.api) return;

  checkout.poller.start(
    () => verifyActive(checkout),
    (payload) => handlePayload(payload, true),
    delay,
  );
}

async function refreshActiveStatus(): Promise<void> {
  const checkout = active;
  if (!checkout || !checkout.api) return;

  checkout.poller.stop();
  checkout.modal.setStatusRefreshing(true);

  try {
    const payload = await verifyActive(checkout);
    if (active !== checkout) return;
    handlePayload(payload, true);

    if (!checkout.machine.isTerminal()) {
      startPolling(getPollDelay(payload));
    }
  } catch {
    if (active === checkout && !checkout.machine.isTerminal()) {
      startPolling(5000);
    }
  } finally {
    if (active === checkout) checkout.modal.setStatusRefreshing(false);
  }
}

async function verifyActive(
  checkout: ActiveCheckout,
): Promise<VerificationPayload> {
  if (!checkout.api) return {};

  if (
    checkout.modal.getSelectedChannel() === "bank-transfer" &&
    extractBankTransfer(checkout.bootstrap)
  ) {
    try {
      const response = await checkout.api.verifyBankTransfer(
        checkout.reference,
      );
      return response.data;
    } catch {
      const response = await checkout.api.verify(checkout.reference);
      return response.data;
    }
  }

  const response = await checkout.api.verify(checkout.reference);
  return response.data;
}

function handlePayload(
  payload: BootstrapPayload | VerificationPayload,
  fromPoll: boolean,
): void {
  const checkout = active;
  if (!checkout) return;

  const status = normalizeStatus(extractStatus(payload));
  const transaction = extractTransaction(payload);

  if (status === "success") {
    checkout.poller.stop();
    checkout.machine.send({ type: "SUCCESS" });
    checkout.modal.renderSuccess();
    if (!checkout.successCalled) {
      checkout.successCalled = true;
      checkout.options.onSuccess?.(transaction);
    }
    return;
  }

  if (status === "expired") {
    checkout.poller.stop();
    checkout.machine.send({ type: "EXPIRE" });
    checkout.modal.renderExpired();
    callErrorOnce({
      code: "payment_expired",
      message: "This checkout has expired. Please start a new payment.",
    });
    return;
  }

  if (status === "failed") {
    checkout.poller.stop();
    checkout.machine.send({ type: "FAIL" });
    checkout.modal.renderFailure("This payment could not be completed.");
    callErrorOnce({
      code: "payment_failed",
      message: "This payment could not be completed.",
    });
    return;
  }

  if (fromPoll || status === "pending") {
    checkout.machine.send({ type: "PENDING" });
    if (
      checkout.modal.getSelectedChannel() === "bank-transfer" &&
      checkout.bootstrap &&
      extractBankTransfer(checkout.bootstrap)
    ) {
      checkout.modal.renderCheckout(
        checkout.bootstrap,
        checkout.options.channels,
        extractStatus(payload) ?? "pending",
      );
    } else {
      checkout.modal.renderPending(payload as VerificationPayload);
    }
    checkout.options.onPending?.(payload as VerificationPayload);
  } else {
    checkout.machine.send({ type: "READY" });
  }
}

function callErrorOnce(payload: CheckoutErrorPayload): void {
  const checkout = active;
  if (!checkout || checkout.errorCalled) return;
  checkout.errorCalled = true;
  checkout.options.onError?.(payload);
}

function renderValidationError(
  options: PayIslandCheckoutOptions | undefined,
  error: CheckoutErrorPayload,
): void {
  const modal = new CheckoutModal({
    container: options?.container,
    theme: options?.theme ?? {},
    onClose: (reason) => close(reason === "user"),
    onRetry: () => undefined,
    onChannelSelected: () => undefined,
    onRefreshStatus: () => undefined,
  });
  const machine = new CheckoutStateMachine({
    reference: "",
    theme: options?.theme ?? {},
    status: "failed",
  });
  active = {
    options: options ?? { reference: "" },
    reference: "",
    modal,
    poller: new VerificationPoller(),
    machine,
    successCalled: false,
    errorCalled: true,
    closeCalled: false,
  };
  modal.mount();
  modal.renderError(error, false);
}

function toErrorPayload(error: unknown): CheckoutErrorPayload {
  if (error instanceof CheckoutError) return error.toPayload();
  return {
    code: "checkout_error",
    message: "We could not continue with this checkout.",
  };
}

const PayIslandCheckout = { open, close };

declare global {
  interface Window {
    PayIslandCheckout?: typeof PayIslandCheckout;
  }
}

if (typeof window !== "undefined") {
  window.PayIslandCheckout = PayIslandCheckout;
}

export default PayIslandCheckout;
