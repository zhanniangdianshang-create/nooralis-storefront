const { getCheckoutSettings } = require("./_checkout");
const { getPayPalSettings, sendJson } = require("./_paypal");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const settings = getPayPalSettings();
  const checkout = getCheckoutSettings();

  sendJson(response, 200, {
    status: "ok",
    checkoutProvider: checkout.provider,
    checkoutConfigured: checkout.configured,
    paypalConfigured: Boolean(settings.paypalClientId && settings.paypalClientSecret),
    paypalEnvironment: settings.paypalEnvironment,
    currency: settings.currency
  });
};
