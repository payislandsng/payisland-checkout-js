import type { VerificationPayload } from "./types";
import { getPollDelay } from "./utils";

export class VerificationPoller {
  private timer?: number;
  private stopped = true;

  start(
    verify: () => Promise<VerificationPayload>,
    onResult: (payload: VerificationPayload) => void,
    initialDelay = 0,
  ): void {
    this.stop();
    this.stopped = false;

    const tick = async () => {
      if (this.stopped) return;

      try {
        const payload = await verify();
        if (this.stopped) return;
        onResult(payload);
        if (this.stopped) return;
        this.timer = window.setTimeout(tick, getPollDelay(payload));
      } catch {
        if (!this.stopped) this.timer = window.setTimeout(tick, 5000);
      }
    };

    this.timer = window.setTimeout(tick, initialDelay);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
