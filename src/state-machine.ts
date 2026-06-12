import type { CheckoutContext, NormalizedStatus } from "./types";

export type CheckoutEvent =
  | { type: "LOAD" }
  | { type: "READY" }
  | { type: "PENDING" }
  | { type: "SUCCESS" }
  | { type: "FAIL" }
  | { type: "CLOSE" };

const transitions: Record<
  NormalizedStatus,
  Partial<Record<CheckoutEvent["type"], NormalizedStatus>>
> = {
  idle: { LOAD: "loading", CLOSE: "closed" },
  loading: {
    READY: "ready",
    PENDING: "pending",
    SUCCESS: "success",
    FAIL: "failed",
    CLOSE: "closed",
  },
  ready: {
    PENDING: "pending",
    SUCCESS: "success",
    FAIL: "failed",
    CLOSE: "closed",
  },
  pending: {
    READY: "ready",
    PENDING: "pending",
    SUCCESS: "success",
    FAIL: "failed",
    CLOSE: "closed",
  },
  success: { CLOSE: "closed" },
  failed: { CLOSE: "closed" },
  closed: {},
};

export class CheckoutStateMachine {
  context: CheckoutContext;

  constructor(context: CheckoutContext) {
    this.context = context;
  }

  send(event: CheckoutEvent): NormalizedStatus {
    const next = transitions[this.context.status][event.type];
    if (next) this.context.status = next;
    return this.context.status;
  }

  isTerminal(): boolean {
    return (
      this.context.status === "success" ||
      this.context.status === "failed" ||
      this.context.status === "closed"
    );
  }
}
