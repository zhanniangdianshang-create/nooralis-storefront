# Nooralis Storefront Launch Guide

## Current Status

This project is ready to deploy as a Vercel storefront with switchable checkout providers.

Included:
- English product landing page and order section
- Two product videos in `assets/videos/`
- Config-driven checkout switch for hosted links, PayPal, or manual invoice fallback
- PayPal order creation and payment capture endpoints
- Vercel Function for `/api/checkout/config`
- Vercel Functions for `/api/paypal/*`
- Production-safe static file routing
- Health check at `/healthz`
- SEO helpers at `/robots.txt` and `/sitemap.xml`
- Vercel deployment config in `vercel.json`

## Recommended Domain

Buy **nooraliswings.com**.

Why:
- `.com` is the strongest choice for the US, Europe, and Middle East.
- The name connects directly to flying butterfly performances.
- It avoids the unavailable `nooralis.com` domain.

After purchase, use the DNS records shown by Vercel after adding the domain.
They usually look like:

```text
Type: CNAME
Name: www
Value: cname.vercel-dns.com

Type: A
Name: @
Value: 76.76.21.21
```

Always follow the exact values Vercel shows in the project domain screen.

## Recommended Payment Route For China-Based Merchants

Use a hosted checkout provider such as **Oceanpayment Payment Links**.

Recommended environment:

```env
CHECKOUT_PROVIDER=hosted_link
CHECKOUT_PROVIDER_NAME=Oceanpayment
HOSTED_CHECKOUT_URL=your_oceanpayment_payment_link
HOSTED_CHECKOUT_SINGLE_UNIT_ONLY=true
CHECKOUT_BADGES=Cards|Apple Pay|Google Pay|Localized payment methods
```

This keeps the site simple:

1. The product page stays on your domain.
2. Buyers click through to the provider's secure hosted checkout page.
3. Bulk or custom orders still go through the quote form.

## PayPal Optional Fallback

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
CHECKOUT_PROVIDER=hosted_link
CHECKOUT_PROVIDER_NAME=Oceanpayment
HOSTED_CHECKOUT_URL=your_oceanpayment_payment_link
HOSTED_CHECKOUT_SINGLE_UNIT_ONLY=true
PAYPAL_ENVIRONMENT=live
PAYPAL_CLIENT_ID=your_live_paypal_client_id
PAYPAL_CLIENT_SECRET=your_live_paypal_secret
PRODUCT_NAME=Nooralis LED Bionic Butterfly Drone
PRODUCT_PRICE_CENTS=34900
PRODUCT_CURRENCY=usd
```

## Deploy On Vercel

1. Push this folder to a GitHub repository.
2. Import the repository into Vercel or deploy with `vercel --prod`.
3. Use the production environment variables above.
4. Add `nooraliswings.com` and `www.nooraliswings.com` in Vercel Domains.
5. Copy Vercel's DNS values into Spaceship.
6. Open `/healthz` and confirm `status` is `ok`.
7. Open `/api/checkout/config` and confirm `checkoutProvider` matches the intended gateway.
8. Place a small real hosted-checkout or PayPal order and refund it to verify the live flow.

## Deploy On Render Later

Render remains an option after billing is available. Use `render.yaml`, `npm install`,
and `npm start`.

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
- Confirm hosted-checkout onboarding status, settlement account, and withdrawal method.
- Confirm product shipping cost, delivery time, warranty, and return process.
