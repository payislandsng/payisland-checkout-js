import { afterEach, vi } from "vitest";
import { close } from "../src";

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    writeText: vi.fn(),
  },
});

afterEach(() => {
  close(false);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});
