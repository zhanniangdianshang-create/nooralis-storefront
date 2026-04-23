# Nooralis Storefront

English storefront for the Nooralis LED bionic butterfly drone, with PayPal Checkout and product videos.

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

## Required Production Environment

```env
PUBLIC_BASE_URL=https://nooraliswings.com
PAYPAL_ENVIRONMENT=live
PAYPAL_CLIENT_ID=your_live_paypal_client_id
PAYPAL_CLIENT_SECRET=your_live_paypal_secret
PRODUCT_PRICE_CENTS=34900
PRODUCT_CURRENCY=usd
```

## Deploy

Use Vercel for the no-card launch path, or a Node.js host such as Render after billing is available.
See `DEPLOYMENT.md` for the launch checklist.
