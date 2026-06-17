import type { CheckoutContext, NormalizedStatus } from "./types";
export type CheckoutEvent = {
    type: "LOAD";
} | {
    type: "READY";
} | {
    type: "PENDING";
} | {
    type: "SUCCESS";
} | {
    type: "FAIL";
} | {
    type: "EXPIRE";
} | {
    type: "CLOSE";
};
export declare class CheckoutStateMachine {
    context: CheckoutContext;
    constructor(context: CheckoutContext);
    send(event: CheckoutEvent): NormalizedStatus;
    isTerminal(): boolean;
}
