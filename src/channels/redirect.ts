import { safeUrl } from "../utils";

export function openRedirect(url?: string): boolean {
  const target = safeUrl(url);
  if (!target) return false;
  window.open(target, "_blank", "noopener,noreferrer");
  return true;
}
