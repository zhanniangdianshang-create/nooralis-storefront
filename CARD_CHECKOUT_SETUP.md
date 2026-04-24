# Card Checkout Setup

## Recommended Route

For this storefront, the best next step is **Oceanpayment Payment Links**.

Why this is the recommended route for your current setup:

- Oceanpayment's official site says its Payment Links support **500+ payment methods**, including **credit cards, debit cards, Apple Pay, and Google Pay**.
- Oceanpayment also presents itself as a cross-border payment provider built for global merchants and highlights dedicated China teams and support.
- Stripe's official global availability page lists supported merchant countries/regions, and **China is not listed** for standard payment acceptance.

Official references:

- Oceanpayment homepage: <https://www.oceanpayment.com/>
- Oceanpayment Payment Links: <https://www.oceanpayment.com/cn/payment-links/>
- Oceanpayment self-registration: <https://accounts.oceanpayment.com/service/merchantSelf/register>
- Oceanpayment contact sales: <https://www.oceanpayment.com/contact-sales>
- Stripe global availability: <https://stripe.com/global>

## What You Need From Oceanpayment

After registration and approval, ask Oceanpayment for one of these:

1. A **hosted payment link** for the Nooralis single-kit checkout
2. Or the equivalent hosted checkout URL generated from their merchant backend

For the current site, the fastest launch path is the hosted payment link.

## One-Command Production Switch

Once you have the hosted card checkout URL, run:

```powershell
.\scripts\set-hosted-card-prod.ps1 -CheckoutUrl "https://your-card-checkout-link"
```

What the script does:

- switches `CHECKOUT_PROVIDER` to `hosted_link`
- updates the production checkout button label to **Pay by Credit / Debit Card**
- updates badges to **Visa / Mastercard / Apple Pay / Google Pay**
- writes the hosted checkout URL into Vercel production env
- triggers a fresh production deploy

## Current Live Situation

Right now production still uses the temporary **PayPal.Me** path.

The site is already coded to switch cleanly to hosted card checkout. The only missing production input is the real card checkout URL from Oceanpayment.

