const allowedColors = new Set(["Golden", "Pink-Purple", "Blue", "Red", "Custom color inquiry"]);
const allowedVariants = new Set(["LED performance version", "Standard non-LED version"]);

function getPayPalSettings() {
  const paypalEnvironment = (process.env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase();

  return {
    paypalClientId: process.env.PAYPAL_CLIENT_ID || "",
    paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
    paypalEnvironment,
    paypalBaseUrl: paypalEnvironment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
    currency: (process.env.PRODUCT_CURRENCY || "USD").toUpperCase(),
    productName: process.env.PRODUCT_NAME || "Nooralis LED Bionic Butterfly Drone",
    unitAmountCents: Number(process.env.PRODUCT_PRICE_CENTS || 34900),
    publicBaseUrl: (process.env.PUBLIC_BASE_URL || "https://nooraliswings.com").replace(/\/+$/, "")
  };
}

function normalizeOrderInput(body = {}) {
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

function setApiHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function sendJson(response, statusCode, payload) {
  setApiHeaders(response);
  response.status(statusCode).json(payload);
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}

async function generatePayPalAccessToken(settings = getPayPalSettings()) {
  if (!settings.paypalClientId || !settings.paypalClientSecret) {
    throw new Error("PayPal credentials are not configured.");
  }

  const auth = Buffer.from(`${settings.paypalClientId}:${settings.paypalClientSecret}`).toString("base64");
  const response = await fetch(`${settings.paypalBaseUrl}/v1/oauth2/token`, {
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

module.exports = {
  formatMoney,
  generatePayPalAccessToken,
  getPayPalSettings,
  normalizeOrderInput,
  readJsonBody,
  sendJson,
  setApiHeaders
};
