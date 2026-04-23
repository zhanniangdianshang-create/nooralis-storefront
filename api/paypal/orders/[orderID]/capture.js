const { generatePayPalAccessToken, getPayPalSettings, sendJson } = require("../../../_paypal");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const settings = getPayPalSettings();
  const { orderID } = request.query;

  if (!orderID) {
    sendJson(response, 400, { error: "Missing PayPal order ID." });
    return;
  }

  try {
    const accessToken = await generatePayPalAccessToken(settings);
    const paypalResponse = await fetch(`${settings.paypalBaseUrl}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await paypalResponse.json();
    sendJson(response, paypalResponse.ok ? 200 : paypalResponse.status, data);
  } catch (error) {
    sendJson(response, 503, {
      error: error.message || "Unable to capture PayPal order."
    });
  }
};
