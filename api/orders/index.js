const {
  isDashboardAuthorized,
  listOrders,
  normalizeOrderSubmission,
  saveOrder,
  sendUnauthorized
} = require("../_orders");
const { readJsonBody, sendJson } = require("../_paypal");

module.exports = async function handler(request, response) {
  if (request.method === "POST") {
    const body = await readJsonBody(request);
    const normalized = normalizeOrderSubmission(body);

    if (!normalized.valid) {
      sendJson(response, 400, {
        error: "Missing required fields.",
        missing: normalized.missing
      });
      return;
    }

    try {
      const saved = await saveOrder(normalized.order);
      sendJson(response, 201, {
        ok: true,
        orderReference: saved.orderReference,
        submittedAt: saved.submittedAt
      });
    } catch (error) {
      console.error(error);
      sendJson(response, 503, {
        error: "Unable to save order details right now."
      });
    }
    return;
  }

  if (request.method === "GET") {
    if (!isDashboardAuthorized(request)) {
      sendUnauthorized(response);
      return;
    }

    const requestedLimit = Number.parseInt(request.query && request.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(200, requestedLimit)) : 100;

    try {
      const orders = await listOrders(limit);
      sendJson(response, 200, {
        ok: true,
        count: orders.length,
        orders
      });
    } catch (error) {
      console.error(error);
      sendJson(response, 503, {
        error: "Unable to load orders right now."
      });
    }
    return;
  }

  response.setHeader("Allow", "GET, POST");
  sendJson(response, 405, { error: "Method not allowed." });
};
