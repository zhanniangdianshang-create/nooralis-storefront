const { getPayPalSettings, sendJson } = require("../_paypal");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const settings = getPayPalSettings();

  sendJson(response, 200, {
    clientId: settings.paypalClientId,
    currency: settings.currency,
    environment: settings.paypalEnvironment,
    configured: Boolean(settings.paypalClientId && settings.paypalClientSecret)
  });
};
