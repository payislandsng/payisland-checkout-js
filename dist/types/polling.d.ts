import type { VerificationPayload } from "./types";
export declare class VerificationPoller {
    private timer?;
    private stopped;
    start(verify: () => Promise<VerificationPayload>, onResult: (payload: VerificationPayload) => void, initialDelay?: number): void;
    stop(): void;
}
