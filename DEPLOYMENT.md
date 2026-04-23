# Nooralis Storefront Launch Guide

## Current Status

This project is ready to deploy as a Node.js storefront with PayPal Checkout.

Included:
- English product landing page and order section
- Two product videos in `assets/videos/`
- PayPal order creation and payment capture endpoints
- Production-safe static file routing
- Health check at `/healthz`
- SEO helpers at `/robots.txt` and `/sitemap.xml`
- Render deployment blueprint in `render.yaml`

## Recommended Domain

Buy **nooraliswings.com**.

Why:
- `.com` is the strongest choice for the US, Europe, and Middle East.
- The name connects directly to flying butterfly performances.
- It avoids the unavailable `nooralis.com` domain.

After purchase, use these DNS records:

```text
Type: CNAME
Name: www
Value: your Render service domain

Type: ALIAS / ANAME / CNAME flattening
Name: @
Value: your Render service domain
```

If the registrar does not support ALIAS/ANAME at the root, put DNS on Cloudflare and enable CNAME flattening.

## PayPal

Use a PayPal Business account.

Required live values:

```env
PAYPAL_ENVIRONMENT=live
PAYPAL_CLIENT_ID=your_live_paypal_client_id
PAYPAL_CLIENT_SECRET=your_live_paypal_secret
```

Create the app in the PayPal Developer Dashboard:

1. Log in with the PayPal Business account.
2. Create a REST app.
3. Switch the app to Live.
4. Copy the Live Client ID and Secret.
5. Add both values to the hosting environment variables.

## Production Environment

Use these variables on the hosting platform:

```env
PUBLIC_BASE_URL=https://nooraliswings.com
PAYPAL_ENVIRONMENT=live
PAYPAL_CLIENT_ID=your_live_paypal_client_id
PAYPAL_CLIENT_SECRET=your_live_paypal_secret
PRODUCT_NAME=Nooralis LED Bionic Butterfly Drone
PRODUCT_PRICE_CENTS=34900
PRODUCT_CURRENCY=usd
```

## Deploy On Render

1. Push this folder to a GitHub repository.
2. In Render, create a new Web Service from that repository.
3. Use:

```text
Build command: npm install
Start command: npm start
```

4. Add the production environment variables above.
5. Deploy.
6. Add the custom domain `nooraliswings.com` and `www.nooraliswings.com`.
7. Copy Render's DNS target into your domain DNS records.
8. Open `/healthz` and confirm `status` is `ok`.
9. Place a small real PayPal order and refund it inside PayPal to verify live checkout.

## Local Commands

```bash
npm install
npm run check
npm start
```

Local preview:

```text
http://localhost:3000
```

## Video Files

The live page uses:

- `assets/videos/commercial-application.mp4`
- `assets/videos/product-demo.mp4`

Only publish videos you own, recorded yourself, received from the supplier with written permission, or licensed for commercial reuse.

## Before Running Ads

- Set up `sales@nooraliswings.com` or replace it in `config.js`.
- Add Privacy Policy, Terms, Refund Policy, and Shipping Policy pages.
- Confirm PayPal Business account limits and withdrawal method.
- Confirm product shipping cost, delivery time, warranty, and return process.
