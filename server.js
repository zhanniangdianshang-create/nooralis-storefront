require("dotenv").config();

const express = require("express");
const path = require("path");
const { getCheckoutSettings } = require("./api/_checkout");
const {
  getDashboardPassword,
  isDashboardAuthorized,
  listOrders,
  normalizeOrderSubmission,
  saveOrder,
  sendUnauthorized
} = require("./api/_orders");

const app = express();
const port = process.env.PORT || 3000;
const configuredPublicBaseUrl = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const unitAmountCents = Number(process.env.PRODUCT_PRICE_CENTS || 34900);
const currency = (process.env.PRODUCT_CURRENCY || "USD").toUpperCase();
const productName = process.env.PRODUCT_NAME || "Nooralis LED Bionic Butterfly Drone";
const paypalClientId = process.env.PAYPAL_CLIENT_ID || "";
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
const paypalEnvironment = (process.env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase();
const paypalBaseUrl =
  paypalEnvironment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

const allowedColors = new Set(["Golden", "Pink-Purple", "Blue", "Red", "Custom color inquiry"]);
const allowedVariants = new Set(["LED performance version", "Standard non-LED version"]);
const publicFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/showcase.html", "showcase.html"],
  ["/success.html", "success.html"],
  ["/cancel.html", "cancel.html"],
  ["/order-submitted.html", "order-submitted.html"],
  ["/orders.html", "orders.html"],
  ["/payment-details.html", "payment-details.html"],
  ["/policies.html", "policies.html"],
  ["/styles.css", "styles.css"],
  ["/script.js", "script.js"],
  ["/config.js", "config.js"]
]);

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(express.json({ limit: "20kb" }));
app.use(
  "/assets",
  express.static(path.join(__dirname, "assets"), {
    dotfiles: "ignore",
    etag: true,
    maxAge: "30d"
  })
);

function normalizeOrderInput(body) {
  const color = allowedColors.has(body.color) ? body.color : "Golden";
  const variant = allowedVariants.has(body.variant) ? body.variant : "LED performance version";
  const parsedQuantity = Number.parseInt(body.quantity, 10);
  const quantity = Number.isFinite(parsedQuantity) ? Math.max(1, Math.min(20, parsedQuantity)) : 1;
  const email = String(body.email || "").trim();

  return { color, variant, quantity, email };
}

function formatMoney(cents) {
  return (cents / 100).toFixed(2);
}

function getPublicBaseUrl(request) {
  if (configuredPublicBaseUrl) {
    return configuredPublicBaseUrl;
  }

  const forwardedProto = request.get("x-forwarded-proto");
  const forwardedHost = request.get("x-forwarded-host");
  const protocol = forwardedProto ? forwardedProto.split(",")[0].trim() : request.protocol;
  const host = forwardedHost ? forwardedHost.split(",")[0].trim() : request.get("host");
  return `${protocol}://${host || `localhost:${port}`}`;
}

async function generatePayPalAccessToken() {
  if (!paypalClientId || !paypalClientSecret) {
    throw new Error("PayPal credentials are not configured.");
  }

  const auth = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Unable to authenticate with PayPal.");
  }

  return data.access_token;
}

app.get("/healthz", (request, response) => {
  const checkoutSettings = getCheckoutSettings();
  response.json({
    status: "ok",
    checkoutProvider: checkoutSettings.provider,
    checkoutConfigured: checkoutSettings.configured,
    orderDashboardConfigured: Boolean(getDashboardPassword()),
    paypalConfigured: Boolean(paypalClientId && paypalClientSecret),
    paypalEnvironment,
    currency
  });
});

app.get("/robots.txt", (request, response) => {
  response.type("text/plain").send(["User-agent: *", "Allow: /", `Sitemap: ${getPublicBaseUrl(request)}/sitemap.xml`].join("\n"));
});

app.get("/sitemap.xml", (request, response) => {
  const base = getPublicBaseUrl(request);
  response.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${base}/showcase.html</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${base}/policies.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`);
});

app.get("/api/paypal/config", (request, response) => {
  response.json({
    clientId: paypalClientId,
    currency,
    environment: paypalEnvironment,
    configured: Boolean(paypalClientId && paypalClientSecret)
  });
});

app.get("/api/checkout/config", (request, response) => {
  response.json(getCheckoutSettings());
});

app.post("/api/orders", async (request, response) => {
  const normalized = normalizeOrderSubmission(request.body);
  if (!normalized.valid) {
    response.status(400).json({
      error: "Missing required fields.",
      missing: normalized.missing
    });
    return;
  }

  try {
    const saved = await saveOrder(normalized.order);
    response.status(201).json({
      ok: true,
      orderReference: saved.orderReference,
      submittedAt: saved.submittedAt
    });
  } catch (error) {
    console.error(error);
    response.status(503).json({
      error: "Unable to save order details right now."
    });
  }
});

app.get("/api/orders", async (request, response) => {
  if (!isDashboardAuthorized(request)) {
    sendUnauthorized(response);
    return;
  }

  const requestedLimit = Number.parseInt(request.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(200, requestedLimit)) : 100;

  try {
    const orders = await listOrders(limit);
    response.json({
      ok: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error(error);
    response.status(503).json({
      error: "Unable to load orders right now."
    });
  }
});

app.post("/api/paypal/orders", async (request, response) => {
  const { color, variant, quantity, email } = normalizeOrderInput(request.body);
  const unitAmount = formatMoney(unitAmountCents);
  const totalAmount = formatMoney(unitAmountCents * quantity);
  const publicBaseUrl = getPublicBaseUrl(request);

  try {
    const accessToken = await generatePayPalAccessToken();
    const paypalResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: "NOORALIS-PERFORMANCE-KIT",
            description: `${productName} - ${variant} / ${color}`,
            custom_id: `${variant} | ${color}`,
            amount: {
              currency_code: currency,
              value: totalAmount,
              breakdown: {
                item_total: {
                  currency_code: currency,
                  value: totalAmount
                }
              }
            },
            items: [
              {
                name: productName,
                description: `${variant} / ${color}`,
                quantity: String(quantity),
                unit_amount: {
                  currency_code: currency,
                  value: unitAmount
                },
                category: "PHYSICAL_GOODS"
              }
            ]
          }
        ],
        payer: email ? { email_address: email } : undefined,
        application_context: {
          brand_name: "Nooralis",
          landing_page: "BILLING",
          user_action: "PAY_NOW",
          return_url: `${publicBaseUrl}/success.html`,
          cancel_url: `${publicBaseUrl}/cancel.html`,
          shipping_preference: "GET_FROM_FILE"
        }
      })
    });

    const data = await paypalResponse.json();
    if (!paypalResponse.ok) {
      response.status(paypalResponse.status).json(data);
      return;
    }

    response.json(data);
  } catch (error) {
    console.error(error);
    response.status(503).json({
      error: error.message || "Unable to create PayPal order."
    });
  }
});

app.post("/api/paypal/orders/:orderID/capture", async (request, response) => {
  const { orderID } = request.params;

  try {
    const accessToken = await generatePayPalAccessToken();
    const paypalResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await paypalResponse.json();
    if (!paypalResponse.ok) {
      response.status(paypalResponse.status).json(data);
      return;
    }

    console.log("Paid PayPal order:", {
      id: data.id,
      status: data.status,
      payer: data.payer && data.payer.email_address,
      amount:
        data.purchase_units &&
        data.purchase_units[0] &&
        data.purchase_units[0].payments &&
        data.purchase_units[0].payments.captures &&
        data.purchase_units[0].payments.captures[0] &&
        data.purchase_units[0].payments.captures[0].amount
    });

    response.json(data);
  } catch (error) {
    console.error(error);
    response.status(503).json({
      error: error.message || "Unable to capture PayPal order."
    });
  }
});

app.get(Array.from(publicFiles.keys()), (request, response) => {
  response.sendFile(path.join(__dirname, publicFiles.get(request.path)));
});

app.listen(port, () => {
  const checkoutSettings = getCheckoutSettings();
  console.log(`Nooralis storefront running at http://localhost:${port}`);
  if (!checkoutSettings.configured) {
    console.log(
      `${checkoutSettings.providerName} checkout is not configured. Add HOSTED_CHECKOUT_URL or working gateway credentials to enable online payments.`
    );
  }
});
