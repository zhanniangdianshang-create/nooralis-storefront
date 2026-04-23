const {
  formatMoney,
  generatePayPalAccessToken,
  getPayPalSettings,
  normalizeOrderInput,
  readJsonBody,
  sendJson
} = require("../_paypal");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const settings = getPayPalSettings();
  const body = await readJsonBody(request);
  const { color, variant, quantity, email } = normalizeOrderInput(body);
  const unitAmount = formatMoney(settings.unitAmountCents);
  const totalAmount = formatMoney(settings.unitAmountCents * quantity);

  try {
    const accessToken = await generatePayPalAccessToken(settings);
    const paypalResponse = await fetch(`${settings.paypalBaseUrl}/v2/checkout/orders`, {
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
            description: `${settings.productName} - ${variant} / ${color}`,
            custom_id: `${variant} | ${color}`,
            amount: {
              currency_code: settings.currency,
              value: totalAmount,
              breakdown: {
                item_total: {
                  currency_code: settings.currency,
                  value: totalAmount
                }
              }
            },
            items: [
              {
                name: settings.productName,
                description: `${variant} / ${color}`,
                quantity: String(quantity),
                unit_amount: {
                  currency_code: settings.currency,
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
          return_url: `${settings.publicBaseUrl}/success.html`,
          cancel_url: `${settings.publicBaseUrl}/cancel.html`,
          shipping_preference: "GET_FROM_FILE"
        }
      })
    });

    const data = await paypalResponse.json();
    sendJson(response, paypalResponse.ok ? 200 : paypalResponse.status, data);
  } catch (error) {
    sendJson(response, 503, {
      error: error.message || "Unable to create PayPal order."
    });
  }
};
