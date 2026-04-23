# Nooralis Storefront

English storefront for the Nooralis LED bionic butterfly drone, with switchable checkout providers and product videos.

## Run Locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Check

```bash
npm run check
```

## Recommended Production Environment

```env
PUBLIC_BASE_URL=https://nooraliswings.com
CHECKOUT_PROVIDER=hosted_link
CHECKOUT_PROVIDER_NAME=Oceanpayment
HOSTED_CHECKOUT_URL=your_hosted_checkout_link
ORDER_DASHBOARD_PASSWORD=choose_a_private_dashboard_password
PRODUCT_PRICE_CENTS=34900
PRODUCT_CURRENCY=usd
```

Optional PayPal fallback:

```env
PAYPAL_ENVIRONMENT=live
PAYPAL_CLIENT_ID=your_live_paypal_client_id
PAYPAL_CLIENT_SECRET=your_live_paypal_secret
```

## Deploy

Use Vercel for the no-card launch path, or a Node.js host such as Render after billing is available.
See `DEPLOYMENT.md` for the launch checklist.

## Order Desk

- Customer submission page: `/payment-details.html`
- Private dashboard: `/orders.html`
- Storage: Vercel Blob private store
