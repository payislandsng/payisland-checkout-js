[![CI](https://github.com/payislandsng/payisland-checkout-js/actions/workflows/ci.yml/badge.svg)](https://github.com/payislandsng/payisland-checkout-js/actions/workflows/ci.yml)

# PayIsland Checkout JS

Browser JavaScript inline checkout SDK for PayIsland server-initialized payments.

This SDK is for merchants who initialize payments from their backend with their PayIsland secret key, then pass only the PayIsland transaction reference to the browser checkout.

The browser SDK never requires, accepts, stores, or exposes merchant secret keys. Version 1 supports server-initialized transactions only.

## Install

Script tag:

```html
<script src="https://checkout.payislands.com/sdk/payisland-checkout.js"></script>
```

npm:

```bash
npm install @payisland/checkout-js
```

## Usage

```html
<script src="https://checkout.payislands.com/sdk/payisland-checkout.js"></script>
<script>
  PayIslandCheckout.open({
    reference: "PIST2605220000000117",
    onSuccess: function (transaction) {
      // Verify on your server before fulfillment.
    },
    onPending: function (status) {},
    onClose: function () {},
    onError: function (error) {},
  });
</script>
```

With npm:

```js
import PayIslandCheckout from "@payisland/checkout-js";

PayIslandCheckout.open({
  reference: "PIST2605220000000117",
});
```

## API

The browser global is `window.PayIslandCheckout`.

```js
PayIslandCheckout.open(options);
PayIslandCheckout.close();
```

`options`:

| Option                   | Type                    | Description                                                                     |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------- |
| `reference`              | `string`                | Required PayIsland transaction reference created by your backend.               |
| `container`              | `HTMLElement \| string` | Optional element or selector for inline rendering. Defaults to a modal overlay. |
| `channels`               | `string[]`              | Optional channel allow-list, such as `["card", "bank-transfer", "mono"]`.       |
| `theme.primaryColor`     | `string`                | Primary button and selected control color.                                      |
| `theme.logoUrl`          | `string`                | Merchant logo URL.                                                              |
| `theme.merchantName`     | `string`                | Merchant display name.                                                          |
| `onSuccess(transaction)` | `function`              | Called once when PayIsland returns a successful terminal status.                |
| `onPending(status)`      | `function`              | Called when polling returns a pending status. May run multiple times.           |
| `onError(error)`         | `function`              | Called when validation, bootstrap, or terminal failure occurs.                  |
| `onClose()`              | `function`              | Called when the user intentionally closes checkout.                             |

## Server-Initialized Flow

1. Your backend creates or initializes the transaction using your PayIsland secret key.
2. Your frontend receives the transaction reference only.
3. The frontend calls `PayIslandCheckout.open({ reference })`.
4. The SDK bootstraps checkout with:

```text
GET /api/v1/transactions/gateway/pay/keys/:reference
```

5. The SDK reads the `x-checkout-token` response header when available and keeps it in memory only.
6. After the payer chooses a payment route or manually checks status, the SDK verifies payment in the background until PayIsland returns a terminal status:

```text
POST /api/v1/transactions/gateway/transaction/verify/:reference
GET /api/v1/transactions/gateway/transaction/verify-bank-transfer/:reference
```

Terminal success statuses are `paid`, `successful`, and `success`. Terminal failure statuses are `failed`, `canceled`, `cancelled`, and `reversed`. Expired checkouts are shown as a distinct terminal expired state.

For best display, use a square or near-square merchant logo with a transparent or solid background, ideally at least 64×64 px.

## Channel Behavior

Phase 1 does not collect raw card data in merchant pages. Card payments continue through the secure PayIsland card checkout.

Supported Phase 1 behavior:

- Card initializes the `card` payment channel and embeds a PayIsland-hosted card frame from the returned checkout URL.
- Bank transfer details render when returned by the bootstrap response.
- Selecting bank transfer initializes the `bank-transfer` payment channel and renders the generated account details.
- Status checks run in the background after payer action using `retry_after_ms` or `poll_interval_ms` when provided.
- Polling stops on close or terminal status.
- Successful or paid transactions close the modal and navigate to the PayIsland payment-status page, which continues to the receipt.

## Security Notes

- Never put PayIsland secret keys in browser code.
- Never send merchant secret keys, API keys, PAN, CVV, PIN, OTP, or encrypted card payloads into this SDK.
- Raw card fields are collected only inside a PayIsland-hosted frame. The SDK listens for frame lifecycle events and does not read card details.
- Always verify the transaction server-side before fulfilling an order.
- The checkout token is kept in memory only and cleared when checkout closes.
- The SDK avoids logging sensitive payment values.
- Do not commit real API keys, test secrets, or live customer references.

## CORS Requirements

For merchant websites, PayIsland backend CORS must allow the merchant origin and expose the checkout token header:

```text
Access-Control-Expose-Headers: x-checkout-token
```

Without this header, browsers will hide `x-checkout-token` from JavaScript even if the backend sends it.

## Backend Notes

- Ensure the bootstrap endpoint returns all data needed by the checkout UI: amount, fee, total, customer, merchant, available channels, bank transfer details, and card checkout URL where applicable.
- Ensure `x-checkout-token` is exposed via CORS.
- Ensure verification endpoints return normalized statuses.
- Return `retry_after_ms` or `poll_interval_ms` where possible.

## Development

```bash
npm install
npm run build
npm test
npm run lint
```

Build outputs:

- `dist/payisland-checkout.js`
- `dist/payisland-checkout.min.js`
- `dist/index.mjs`
- `dist/index.cjs`
- `dist/types`

Open `demo/index.html` after running `npm run build` to try local script-tag usage with mocked responses.
