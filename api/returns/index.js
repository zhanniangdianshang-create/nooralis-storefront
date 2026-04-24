const {
  findOrder,
  isDashboardAuthorized,
  listReturns,
  normalizeOrderLookupQuery,
  normalizeReturnSubmission,
  saveReturnRequest,
  updateOrderAfterSalesStatus
} = require("../_orders");
const { notifyReturnSubmission } = require("../_notifications");
const { readJsonBody, sendJson } = require("../_paypal");

module.exports = async function handler(request, response) {
  if (request.method === "GET") {
    if (!isDashboardAuthorized(request)) {
      response.setHeader("WWW-Authenticate", 'Bearer realm="Nooralis Orders"');
      sendJson(response, 401, { error: "Unauthorized." });
      return;
    }

    const requestedLimit = Number.parseInt(request.query && request.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(200, requestedLimit)) : 100;

    try {
      const returns = await listReturns(limit);
      sendJson(response, 200, {
        ok: true,
        count: returns.length,
        returns
      });
    } catch (error) {
      console.error(error);
      sendJson(response, 503, {
        error: "Unable to load return requests right now."
      });
    }
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const body = await readJsonBody(request);
  const normalized = normalizeReturnSubmission(body);

  if (!normalized.valid) {
    sendJson(response, 400, {
      error: "Missing required fields.",
      missing: normalized.missing
    });
    return;
  }

  const orderLookup = normalizeOrderLookupQuery({
    orderReference: normalized.request.orderReference,
    email: normalized.request.email,
    paypalTransactionId: normalized.request.paypalTransactionId
  });

  if (!orderLookup.valid) {
    sendJson(response, 400, {
      error: "Order reference and matching buyer details are required."
    });
    return;
  }

  try {
    const order = await findOrder(orderLookup.query);
    if (!order) {
      sendJson(response, 404, {
        error: "We could not verify this order. Check the order reference and buyer details."
      });
      return;
    }

    const saved = await saveReturnRequest({
      ...normalized.request,
      orderStatusAtRequest: order.orderStatus || "Payment details received"
    });

    await updateOrderAfterSalesStatus(order, `Return request received (${saved.returnReference})`);

    let notifications = {
      enabled: false,
      merchantSent: false,
      buyerSent: false
    };

    try {
      notifications = await notifyReturnSubmission({
        ...normalized.request,
        submittedAt: saved.submittedAt
      });
    } catch (notificationError) {
      console.error(notificationError);
    }

    sendJson(response, 201, {
      ok: true,
      returnReference: saved.returnReference,
      submittedAt: saved.submittedAt,
      notifications
    });
  } catch (error) {
    console.error(error);
    sendJson(response, 503, {
      error: "Unable to save the return request right now."
    });
  }
};
