export const styles = `
:host {
  all: initial;
  --pi-primary: #074761;
  --pi-primary-strong: #05364a;
  --pi-primary-soft: #e7f2f6;
  --pi-accent: #8aa0ad;
  --pi-text: #111827;
  --pi-muted: #607080;
  --pi-border: #d8e1e8;
  --pi-border-strong: #b9c7d1;
  --pi-surface: #ffffff;
  --pi-soft: #f6f9fb;
  --pi-raised: #fbfdfe;
  --pi-danger: #b42318;
  --pi-danger-soft: #fff1f0;
  --pi-success: #067647;
  --pi-success-soft: #e8f8ef;
  --pi-warning: #9a6700;
  --pi-warning-soft: #fff7df;
  --pi-focus: rgba(7, 71, 97, 0.28);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* {
  box-sizing: border-box;
}
button,
input {
  font: inherit;
}
button {
  -webkit-tap-highlight-color: transparent;
}
button:focus-visible {
  outline: 3px solid var(--pi-focus);
  outline-offset: 2px;
}
.pi-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(10, 20, 30, 0.58);
  backdrop-filter: blur(4px);
}
.pi-inline {
  width: 100%;
}
.pi-modal {
  width: min(100%, 480px);
  max-height: min(780px, calc(100vh - 40px));
  overflow: hidden;
  border: 1px solid rgba(216, 225, 232, 0.92);
  border-radius: 14px;
  background: var(--pi-surface);
  color: var(--pi-text);
  box-shadow: 0 28px 90px rgba(8, 18, 28, 0.28);
}
.pi-inline .pi-modal {
  max-height: none;
  box-shadow: 0 10px 32px rgba(8, 18, 28, 0.08);
}
.pi-header,
.pi-body,
.pi-footer {
  padding: 16px 18px;
}
.pi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--pi-border);
  background: linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%);
}
.pi-header-main,
.pi-brand {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
}
.pi-logo-frame {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--pi-border);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 18px rgba(7, 71, 97, 0.08);
}
.pi-logo,
.pi-logo-fallback {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  object-fit: contain;
}
.pi-logo-fallback {
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--pi-primary);
  color: #fff;
  font-weight: 800;
}
.pi-heading {
  min-width: 0;
}
.pi-eyebrow,
.pi-label {
  display: block;
  margin: 0 0 3px;
  color: var(--pi-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.2;
  text-transform: uppercase;
}
.pi-title {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--pi-text);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.25;
}
.pi-subtitle {
  margin: 4px 0 0;
  color: var(--pi-muted);
  font-size: 13px;
  line-height: 1.35;
}
.pi-close {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--pi-muted);
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
}
.pi-close:hover,
.pi-close:focus-visible {
  border-color: var(--pi-border);
  background: #fff;
  color: var(--pi-text);
}
.pi-body {
  max-height: calc(100vh - 178px);
  overflow-y: auto;
  background: var(--pi-surface);
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
  overflow: hidden;
  border: 1px solid var(--pi-border);
  border-radius: 12px;
  background: var(--pi-raised);
}
.pi-summary-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border-bottom: 1px solid var(--pi-border);
  background: linear-gradient(135deg, var(--pi-primary-soft), #ffffff 70%);
}
.pi-summary-hero strong {
  display: block;
  color: var(--pi-primary-strong);
  font-size: 26px;
  font-weight: 850;
  line-height: 1.05;
}
.pi-summary-hero p {
  max-width: 42%;
  margin: 0;
  color: var(--pi-muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  text-align: right;
}
.pi-summary-grid {
  display: grid;
  gap: 0;
  padding: 4px 14px;
}
.pi-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 34px;
  border-bottom: 1px solid rgba(216, 225, 232, 0.72);
  color: var(--pi-muted);
  font-size: 14px;
}
.pi-row:last-child {
  border-bottom: 0;
}
.pi-row strong {
  min-width: 0;
  color: var(--pi-text);
  font-weight: 750;
  overflow-wrap: anywhere;
  text-align: right;
}
.pi-reference strong {
  color: var(--pi-muted);
  font-size: 12px;
  font-weight: 700;
}
.pi-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(124px, 1fr));
  gap: 6px;
  padding: 5px;
  border: 1px solid var(--pi-border);
  border-radius: 12px;
  background: var(--pi-soft);
}
.pi-tab {
  min-height: 40px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--pi-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
}
.pi-tab:hover:not([disabled]) {
  color: var(--pi-text);
  background: #fff;
}
.pi-tab[aria-selected="true"] {
  border-color: rgba(7, 71, 97, 0.18);
  background: var(--pi-primary);
  color: #fff;
  box-shadow: 0 8px 18px rgba(7, 71, 97, 0.18);
}
.pi-tab[disabled] {
  cursor: not-allowed;
  opacity: 0.48;
}
.pi-panel {
  display: grid;
  gap: 12px;
}
.pi-panel-title,
.pi-state-title {
  margin: 0;
  color: var(--pi-text);
  font-size: 16px;
  font-weight: 850;
  line-height: 1.25;
}
.pi-bank-box {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--pi-border);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(8, 18, 28, 0.05);
}
.pi-bank-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.pi-bank-intro strong {
  color: var(--pi-primary-strong);
  font-size: 14px;
  font-weight: 850;
  text-align: right;
}
.pi-account {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(7, 71, 97, 0.16);
  border-radius: 12px;
  background: linear-gradient(180deg, var(--pi-primary-soft), #fff);
}
.pi-account > span {
  color: var(--pi-muted);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.pi-account-number {
  color: var(--pi-primary-strong);
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.1;
  overflow-wrap: anywhere;
}
.pi-bank-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.pi-detail {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--pi-border);
  border-radius: 10px;
  background: var(--pi-soft);
}
.pi-detail span {
  color: var(--pi-muted);
  font-size: 12px;
  font-weight: 750;
}
.pi-detail strong {
  min-width: 0;
  color: var(--pi-text);
  font-size: 14px;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.pi-copy,
.pi-primary,
.pi-secondary {
  min-height: 42px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
}
.pi-copy {
  justify-self: start;
  border: 1px solid var(--pi-primary);
  background: #fff;
  color: var(--pi-primary);
  padding: 0 14px;
}
.pi-copy:hover,
.pi-secondary:hover {
  border-color: var(--pi-border-strong);
  background: var(--pi-soft);
}
.pi-primary {
  width: 100%;
  border: 0;
  background: var(--pi-primary);
  color: #fff;
  box-shadow: 0 10px 18px rgba(7, 71, 97, 0.18);
}
.pi-primary:hover,
.pi-primary:focus-visible {
  background: var(--pi-primary-strong);
}
.pi-primary:disabled,
.pi-secondary:disabled {
  cursor: not-allowed;
  opacity: 0.62;
  box-shadow: none;
}
.pi-secondary {
  border: 1px solid var(--pi-border);
  background: #fff;
  color: var(--pi-text);
  padding: 0 14px;
}
.pi-secondary:disabled {
  cursor: wait;
}
.pi-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  border: 1px solid rgba(154, 103, 0, 0.2);
  border-radius: 10px;
  background: var(--pi-warning-soft);
  color: #6f4a00;
  font-size: 13px;
}
.pi-status strong {
  color: #5f3f00;
  font-weight: 850;
  text-align: right;
  text-transform: capitalize;
}
.pi-bank-actions {
  display: grid;
}
.pi-refresh {
  width: 100%;
}
.pi-redirect-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--pi-border);
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, var(--pi-soft));
}
.pi-redirect-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 999px;
  background: var(--pi-primary-soft);
  color: var(--pi-primary);
  font-size: 20px;
  font-weight: 900;
}
.pi-state {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 34px 14px;
  text-align: center;
}
.pi-state-logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
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
  min-width: 40px;
  height: 40px;
  border-radius: 999px;
  font-weight: 900;
}
.pi-badge-success {
  background: var(--pi-success-soft);
  color: var(--pi-success);
}
.pi-badge-error {
  background: var(--pi-danger-soft);
  color: var(--pi-danger);
}
.pi-badge-warning {
  background: var(--pi-warning-soft);
  color: var(--pi-warning);
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
  border-radius: 10px;
  background: #fffbfa;
  color: var(--pi-danger);
  font-size: 14px;
}
.pi-unavailable {
  padding: 14px;
  border: 1px dashed var(--pi-border-strong);
  border-radius: 10px;
  background: var(--pi-soft);
  color: var(--pi-muted);
  font-size: 14px;
}
.pi-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--pi-border);
  background: var(--pi-raised);
}
.pi-secured {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
  padding: 7px 10px;
  border-radius: 999px;
  background: var(--pi-primary-strong);
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  line-height: 1;
}
.pi-secured strong {
  color: #fff;
  font-weight: 850;
}
.pi-secured-logo {
  width: 15px;
  height: 20px;
  object-fit: contain;
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
    padding: 10px;
  }
  .pi-modal {
    width: 100%;
    max-height: calc(100vh - 20px);
    border-radius: 14px 14px 10px 10px;
  }
  .pi-header,
  .pi-body,
  .pi-footer {
    padding: 15px;
  }
  .pi-header {
    gap: 10px;
  }
  .pi-logo-frame {
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }
  .pi-title {
    font-size: 15px;
  }
  .pi-summary-hero {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
  .pi-summary-hero p {
    max-width: none;
    text-align: left;
  }
  .pi-summary-hero strong {
    font-size: 25px;
  }
  .pi-bank-intro,
  .pi-status {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
  .pi-bank-intro strong,
  .pi-status strong {
    text-align: left;
  }
  .pi-bank-grid {
    grid-template-columns: 1fr;
  }
  .pi-account-number {
    font-size: 26px;
  }
  .pi-tabs {
    grid-template-columns: 1fr;
  }
  .pi-footer {
    align-items: stretch;
    flex-direction: column;
  }
  .pi-secured {
    justify-content: center;
  }
}
`;
