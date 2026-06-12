export const styles = `
:host {
  all: initial;
  --pi-primary: #0b7f70;
  --pi-primary-strong: #075f55;
  --pi-text: #17202a;
  --pi-muted: #5f6c7b;
  --pi-border: #d9e2ec;
  --pi-surface: #ffffff;
  --pi-soft: #f5f8fb;
  --pi-danger: #b42318;
  --pi-success: #087443;
  --pi-warning: #9a6700;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* {
  box-sizing: border-box;
}
button,
input {
  font: inherit;
}
.pi-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.54);
}
.pi-inline {
  width: 100%;
}
.pi-modal {
  width: min(100%, 460px);
  max-height: min(760px, calc(100vh - 40px));
  overflow: hidden;
  border: 1px solid var(--pi-border);
  border-radius: 8px;
  background: var(--pi-surface);
  color: var(--pi-text);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
}
.pi-inline .pi-modal {
  max-height: none;
  box-shadow: none;
}
.pi-header,
.pi-body,
.pi-footer {
  padding: 18px 20px;
}
.pi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--pi-border);
}
.pi-brand {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
}
.pi-logo,
.pi-logo-fallback {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 8px;
  object-fit: cover;
}
.pi-logo-fallback {
  display: grid;
  place-items: center;
  background: var(--pi-primary);
  color: #fff;
  font-weight: 700;
}
.pi-title {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
}
.pi-subtitle {
  margin: 3px 0 0;
  color: var(--pi-muted);
  font-size: 13px;
}
.pi-close {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--pi-muted);
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
}
.pi-close:hover,
.pi-close:focus-visible {
  background: var(--pi-soft);
  color: var(--pi-text);
  outline: none;
}
.pi-body {
  max-height: calc(100vh - 190px);
  overflow-y: auto;
}
.pi-inline .pi-body {
  max-height: none;
}
.pi-stack {
  display: grid;
  gap: 16px;
}
.pi-summary {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--pi-border);
  border-radius: 8px;
  background: var(--pi-soft);
}
.pi-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--pi-muted);
  font-size: 14px;
}
.pi-row strong {
  color: var(--pi-text);
  font-weight: 700;
  text-align: right;
}
.pi-row.pi-total {
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid var(--pi-border);
  color: var(--pi-text);
}
.pi-row.pi-total strong {
  font-size: 18px;
}
.pi-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
}
.pi-tab {
  min-height: 40px;
  border: 1px solid var(--pi-border);
  border-radius: 8px;
  background: #fff;
  color: var(--pi-text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
}
.pi-tab[aria-selected="true"] {
  border-color: var(--pi-primary);
  background: color-mix(in srgb, var(--pi-primary) 12%, #fff);
  color: var(--pi-primary-strong);
}
.pi-tab[disabled] {
  cursor: not-allowed;
  opacity: 0.55;
}
.pi-panel {
  display: grid;
  gap: 12px;
}
.pi-bank-box {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--pi-border);
  border-radius: 8px;
}
.pi-account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.pi-account-number {
  font-size: 22px;
  font-weight: 750;
  letter-spacing: 0;
}
.pi-copy,
.pi-primary,
.pi-secondary {
  min-height: 42px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
}
.pi-copy {
  border: 1px solid var(--pi-border);
  background: #fff;
  color: var(--pi-text);
  padding: 0 12px;
}
.pi-primary {
  width: 100%;
  border: 0;
  background: var(--pi-primary);
  color: #fff;
}
.pi-primary:hover,
.pi-primary:focus-visible {
  background: var(--pi-primary-strong);
  outline: none;
}
.pi-secondary {
  border: 1px solid var(--pi-border);
  background: #fff;
  color: var(--pi-text);
  padding: 0 14px;
}
.pi-state {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 28px 10px;
  text-align: center;
}
.pi-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid var(--pi-border);
  border-top-color: var(--pi-primary);
  border-radius: 50%;
  animation: pi-spin 0.8s linear infinite;
}
.pi-badge {
  display: inline-grid;
  place-items: center;
  min-width: 36px;
  height: 36px;
  border-radius: 999px;
  font-weight: 800;
}
.pi-badge-success {
  background: #dcfce7;
  color: var(--pi-success);
}
.pi-badge-error {
  background: #fee4e2;
  color: var(--pi-danger);
}
.pi-message {
  margin: 0;
  color: var(--pi-muted);
  font-size: 14px;
  line-height: 1.5;
}
.pi-error {
  padding: 12px;
  border: 1px solid #fecdca;
  border-radius: 8px;
  background: #fffbfa;
  color: var(--pi-danger);
  font-size: 14px;
}
.pi-unavailable {
  padding: 12px;
  border: 1px dashed var(--pi-border);
  border-radius: 8px;
  color: var(--pi-muted);
  font-size: 14px;
}
.pi-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid var(--pi-border);
}
.pi-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@keyframes pi-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 520px) {
  .pi-overlay {
    align-items: end;
    padding: 12px;
  }
  .pi-modal {
    width: 100%;
    max-height: calc(100vh - 24px);
  }
  .pi-header,
  .pi-body,
  .pi-footer {
    padding: 16px;
  }
  .pi-row,
  .pi-account {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
  .pi-row strong {
    text-align: left;
  }
}
`;
