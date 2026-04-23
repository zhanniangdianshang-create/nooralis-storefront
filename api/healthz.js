const { getPayPalSettings, sendJson } = require("./_paypal");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const settings = getPayPalSettings();

  sendJson(response, 200, {
    status: "ok",
    paypalConfigured: Boolean(settings.paypalClientId && settings.paypalClientSecret),
    paypalEnvironment: settings.paypalEnvironment,
    currency: settings.currency
  });
};
