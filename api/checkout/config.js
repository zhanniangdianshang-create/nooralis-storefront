const { getCheckoutSettings } = require("../_checkout");
const { sendJson } = require("../_paypal");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  sendJson(response, 200, getCheckoutSettings());
};
