const { findOrder, getPublicOrderView, normalizeOrderLookupQuery } = require("../_orders");
const { readJsonBody, sendJson } = require("../_paypal");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const body = await readJsonBody(request);
  const normalized = normalizeOrderLookupQuery(body);

  if (!normalized.valid) {
    sendJson(response, 400, {
      error: "Missing required fields.",
      missing: normalized.missing
    });
    return;
  }

  try {
    const order = await findOrder(normalized.query);
    if (!order) {
      sendJson(response, 404, {
        error: "Order not found."
      });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      order: getPublicOrderView(order)
    });
  } catch (error) {
    console.error(error);
    sendJson(response, 503, {
      error: "Unable to load order status right now."
    });
  }
};
