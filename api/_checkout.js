const { getPayPalSettings } = require("./_paypal");

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function splitBadges(value, fallback) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCheckoutSettings() {
  const paypal = getPayPalSettings();
  const paypalConfigured = Boolean(paypal.paypalClientId && paypal.paypalClientSecret);
  const requestedProvider = String(process.env.CHECKOUT_PROVIDER || "").trim().toLowerCase();
  const hostedCheckoutUrl = String(process.env.HOSTED_CHECKOUT_URL || "").trim();
  const hostedCheckoutConfigured = Boolean(hostedCheckoutUrl);
  const supportedProviders = new Set(["paypal", "hosted_link", "manual"]);

  let provider = requestedProvider;
  if (!provider) {
    provider = hostedCheckoutConfigured ? "hosted_link" : paypalConfigured ? "paypal" : "manual";
  }

  if (!supportedProviders.has(provider)) {
    provider = "manual";
  }

  let configured = false;
  let providerName = String(process.env.CHECKOUT_PROVIDER_NAME || "").trim();
  let actionLabel = String(process.env.CHECKOUT_ACTION_LABEL || "").trim();
  let note = String(process.env.CHECKOUT_NOTE || "").trim();
  let badges = [];
  let checkoutUrl = "";
  let singleUnitOnly = false;
  let openInNewTab = true;
  let paypalConfig = null;

  if (provider === "paypal") {
    configured = paypalConfigured;
    providerName = providerName || "PayPal";
    actionLabel = actionLabel || "Pay with PayPal";
    note =
      note ||
      (configured
        ? "Complete your payment with PayPal or a major card."
        : "PayPal checkout is not configured right now. Use the quote form below while we switch gateways.");
    badges = splitBadges(process.env.CHECKOUT_BADGES, [
      "PayPal",
      "Card via PayPal",
      "Buyer protection",
      "Global checkout"
    ]);
    openInNewTab = false;
    paypalConfig = {
      clientId: paypal.paypalClientId,
      environment: paypal.paypalEnvironment
    };
  } else if (provider === "hosted_link") {
    configured = hostedCheckoutConfigured;
    providerName = providerName || "Oceanpayment";
    actionLabel = actionLabel || "Continue to Secure Card Checkout";
    note =
      note ||
      (configured
        ? "Hosted checkout is set up for single-kit online payments. For 2+ kits, urgent shows, or custom finishes, use the quote form below."
        : `${providerName} checkout is being activated. Use the quote form below while merchant onboarding is completed.`);
    badges = splitBadges(process.env.CHECKOUT_BADGES, [
      "Cards",
      "Apple Pay",
      "Google Pay",
      "Localized payment methods"
    ]);
    checkoutUrl = hostedCheckoutUrl;
    singleUnitOnly = parseBoolean(process.env.HOSTED_CHECKOUT_SINGLE_UNIT_ONLY, true);
  } else {
    configured = false;
    providerName = providerName || "Sales invoice";
    actionLabel = actionLabel || "Request a Secure Invoice";
    note =
      note ||
      "Online card checkout is temporarily unavailable. Use the quote form below and our team will send a secure invoice.";
    badges = splitBadges(process.env.CHECKOUT_BADGES, [
      "Secure inquiry",
      "Card invoice",
      "Bulk orders",
      "Global shipping"
    ]);
    openInNewTab = false;
  }

  return {
    provider,
    configured,
    providerName,
    actionLabel,
    note,
    badges,
    checkoutUrl,
    singleUnitOnly,
    openInNewTab,
    currency: paypal.currency,
    productName: paypal.productName,
    unitPriceCents: paypal.unitAmountCents,
    paypal: paypalConfig
  };
}

module.exports = {
  getCheckoutSettings
};
