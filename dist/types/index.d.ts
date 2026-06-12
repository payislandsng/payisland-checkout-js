import type { CheckoutErrorPayload, PayIslandCheckoutOptions, TransactionPayload, VerificationPayload } from "./types";
export type { PayIslandCheckoutOptions, CheckoutErrorPayload, TransactionPayload, VerificationPayload, };
export declare function open(options: PayIslandCheckoutOptions): void;
export declare function close(callCallback?: boolean): void;
declare const PayIslandCheckout: {
    open: typeof open;
    close: typeof close;
};
declare global {
    interface Window {
        PayIslandCheckout?: typeof PayIslandCheckout;
    }
}
export default PayIslandCheckout;
