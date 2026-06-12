import type { BootstrapPayload, CheckoutErrorPayload, CheckoutTheme, PaymentChannel, VerificationPayload } from "./types";
type CloseReason = "user" | "programmatic";
interface ModalOptions {
    container?: HTMLElement | string;
    theme: CheckoutTheme;
    onClose: (reason: CloseReason) => void;
    onRetry: () => void;
    onChannelSelected: (channel: PaymentChannel) => void;
}
export declare class CheckoutModal {
    private readonly host;
    private readonly root;
    private readonly options;
    private selectedChannel?;
    private countdownTimer?;
    private previousActiveElement?;
    private inline;
    constructor(options: ModalOptions);
    mount(): void;
    destroy(): void;
    renderLoading(): void;
    renderError(error: CheckoutErrorPayload): void;
    renderCheckout(payload: BootstrapPayload, allowedChannels?: PaymentChannel[]): void;
    renderPending(payload?: VerificationPayload): void;
    renderSuccess(): void;
    renderFailure(message: string): void;
    private renderShell;
    private setBody;
    private renderSummary;
    private renderTabs;
    private renderChannel;
    private startCountdown;
    private stopCountdown;
    private filterChannels;
    private isSupported;
    private handleClick;
    private handleKeydown;
    private focusFirst;
    private resolveContainer;
}
export {};
