const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { get, list, put } = require("@vercel/blob");
const { sendJson } = require("./_paypal");

const allowedColors = new Set(["Golden", "Pink-Purple", "Blue", "Red", "Custom color inquiry"]);
const allowedVariants = new Set(["LED performance version", "Standard non-LED version"]);
const localOrderDir = path.join(__dirname, "..", ".data", "orders");
const localReturnDir = path.join(__dirname, "..", ".data", "returns");

function sanitizeText(value, maxLength = 500) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function sanitizeMultilineText(value, maxLength = 3000) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function sanitizeEmail(value) {
  return sanitizeText(value, 160).toLowerCase();
}

function parseQuantity(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(20, parsed)) : fallback;
}

function createOrderReference() {
  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0")
  ].join("");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `NRL-${stamp}-${random}`;
}

function normalizeOrderReference(value) {
  const cleaned = sanitizeText(value, 40).toUpperCase();
  if (/^NRL-\d{8}-[A-Z0-9]{4,12}$/.test(cleaned)) {
    return cleaned;
  }
  return createOrderReference();
}

function createReturnReference() {
  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0")
  ].join("");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `RMA-${stamp}-${random}`;
}

function getDashboardPassword() {
  return String(process.env.ORDER_DASHBOARD_PASSWORD || "").trim();
}

function isDashboardAuthorized(request) {
  const password = getDashboardPassword();
  if (!password) {
    return false;
  }

  const headerValue = String(request.headers["x-dashboard-key"] || "").trim();
  const authHeader = String(request.headers.authorization || "").trim();
  const bearerValue = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const queryValue = request.query && typeof request.query.key === "string" ? request.query.key.trim() : "";
  return [headerValue, bearerValue, queryValue].includes(password);
}

function sendUnauthorized(response) {
  response.setHeader("WWW-Authenticate", 'Bearer realm="Nooralis Orders"');
  sendJson(response, 401, { error: "Unauthorized." });
}

function normalizeOrderSubmission(body = {}) {
  const orderReference = normalizeOrderReference(body.orderReference);
  const color = allowedColors.has(body.color) ? body.color : "Golden";
  const variant = allowedVariants.has(body.variant) ? body.variant : "LED performance version";
  const quantity = parseQuantity(body.quantity, 1);
  const fullName = sanitizeText(body.fullName, 120);
  const email = sanitizeEmail(body.email);
  const phone = sanitizeText(body.phone, 80);
  const country = sanitizeText(body.country, 80);
  const city = sanitizeText(body.city, 80);
  const postalCode = sanitizeText(body.postalCode, 40);
  const address = sanitizeMultilineText(body.address, 500);
  const paypalPayerEmail = sanitizeEmail(body.paypalPayerEmail);
  const paypalTransactionId = sanitizeText(body.paypalTransactionId, 160);
  const notes = sanitizeMultilineText(body.notes, 2000);
  const paymentMethod = sanitizeText(body.paymentMethod || "PayPal.Me", 80);

  const missing = [];
  if (!fullName) missing.push("fullName");
  if (!email) missing.push("email");
  if (!phone) missing.push("phone");
  if (!country) missing.push("country");
  if (!city) missing.push("city");
  if (!address) missing.push("address");
  if (!paypalTransactionId) missing.push("paypalTransactionId");

  return {
    valid: missing.length === 0,
    missing,
    order: {
      orderReference,
      paymentMethod,
      fullName,
      email,
      phone,
      country,
      city,
      postalCode,
      address,
      color,
      variant,
      quantity,
      paypalPayerEmail,
      paypalTransactionId,
      notes
    }
  };
}

function normalizeOrderLookupQuery(body = {}) {
  const orderReference = sanitizeText(body.orderReference, 40).toUpperCase();
  const email = sanitizeEmail(body.email);
  const paypalTransactionId = sanitizeText(body.paypalTransactionId, 160);
  const missing = [];

  if (!orderReference) {
    missing.push("orderReference");
  }

  if (!email && !paypalTransactionId) {
    missing.push("email_or_paypalTransactionId");
  }

  return {
    valid: missing.length === 0,
    missing,
    query: {
      orderReference,
      email,
      paypalTransactionId
    }
  };
}

function normalizeReturnSubmission(body = {}) {
  const orderReference = sanitizeText(body.orderReference, 40).toUpperCase();
  const fullName = sanitizeText(body.fullName, 120);
  const email = sanitizeEmail(body.email);
  const phone = sanitizeText(body.phone, 80);
  const paypalTransactionId = sanitizeText(body.paypalTransactionId, 160);
  const returnReason = sanitizeText(body.returnReason, 120);
  const requestedResolution = sanitizeText(body.requestedResolution, 120);
  const itemCondition = sanitizeText(body.itemCondition, 120);
  const issueDetails = sanitizeMultilineText(body.issueDetails, 2000);
  const deliveryDate = sanitizeText(body.deliveryDate, 40);
  const missing = [];

  if (!orderReference) missing.push("orderReference");
  if (!fullName) missing.push("fullName");
  if (!email) missing.push("email");
  if (!paypalTransactionId) missing.push("paypalTransactionId");
  if (!returnReason) missing.push("returnReason");
  if (!requestedResolution) missing.push("requestedResolution");
  if (!itemCondition) missing.push("itemCondition");
  if (!issueDetails) missing.push("issueDetails");

  return {
    valid: missing.length === 0,
    missing,
    request: {
      returnReference: createReturnReference(),
      orderReference,
      fullName,
      email,
      phone,
      paypalTransactionId,
      returnReason,
      requestedResolution,
      itemCondition,
      issueDetails,
      deliveryDate
    }
  };
}

function getOrderStorageMode() {
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}

function buildOrderRecord(order) {
  return {
    ...order,
    orderStatus: order.orderStatus || "Payment details received",
    afterSalesStatus: order.afterSalesStatus || "No return request on file",
    submittedAt: new Date().toISOString()
  };
}

function buildReturnRecord(request) {
  return {
    ...request,
    returnStatus: request.returnStatus || "Return request received",
    submittedAt: new Date().toISOString()
  };
}

function maskTransactionId(value) {
  const clean = sanitizeText(value, 160);
  if (!clean) {
    return "";
  }
  if (clean.length <= 4) {
    return clean;
  }
  return `${"*".repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
}

function getPublicOrderView(record) {
  return {
    orderReference: record.orderReference,
    orderStatus: record.orderStatus || "Payment details received",
    afterSalesStatus: record.afterSalesStatus || "No return request on file",
    submittedAt: record.submittedAt,
    paymentMethod: record.paymentMethod,
    fullName: record.fullName,
    email: record.email,
    country: record.country,
    city: record.city,
    color: record.color,
    variant: record.variant,
    quantity: record.quantity,
    paypalTransactionIdMasked: maskTransactionId(record.paypalTransactionId)
  };
}

async function saveOrderLocally(record) {
  await fs.mkdir(localOrderDir, { recursive: true });
  const pathname = path.join(localOrderDir, `${record.orderReference}.json`);
  await fs.writeFile(pathname, JSON.stringify(record, null, 2), "utf8");
  return {
    pathname,
    url: pathname,
    orderReference: record.orderReference,
    submittedAt: record.submittedAt
  };
}

async function saveOrderToBlob(record) {
  const submittedDate = record.submittedAt.slice(0, 10);
  const pathname = `orders/${submittedDate}/${record.orderReference}.json`;
  const blob = await put(pathname, JSON.stringify(record, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json"
  });
  return {
    pathname: blob.pathname,
    url: blob.url,
    orderReference: record.orderReference,
    submittedAt: record.submittedAt
  };
}

async function saveOrder(order) {
  const record = buildOrderRecord(order);
  if (getOrderStorageMode() === "blob") {
    return saveOrderToBlob(record);
  }
  return saveOrderLocally(record);
}

function getLocalOrderPath(record) {
  return path.join(localOrderDir, `${record.orderReference}.json`);
}

function getBlobOrderPath(record) {
  const submittedDate = String(record.submittedAt || "").slice(0, 10);
  return `orders/${submittedDate}/${record.orderReference}.json`;
}

async function persistOrderLocally(record) {
  await fs.mkdir(localOrderDir, { recursive: true });
  const pathname = getLocalOrderPath(record);
  await fs.writeFile(pathname, JSON.stringify(record, null, 2), "utf8");
  return pathname;
}

async function persistOrderToBlob(record) {
  const pathname = getBlobOrderPath(record);
  await put(pathname, JSON.stringify(record, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
  return pathname;
}

async function updateOrderAfterSalesStatus(record, afterSalesStatus) {
  if (!record || !record.orderReference || !record.submittedAt) {
    return null;
  }

  const nextRecord = {
    ...record,
    afterSalesStatus: sanitizeText(afterSalesStatus, 240) || "Return request received"
  };

  if (getOrderStorageMode() === "blob") {
    await persistOrderToBlob(nextRecord);
  } else {
    await persistOrderLocally(nextRecord);
  }

  return nextRecord;
}

async function saveReturnLocally(record) {
  await fs.mkdir(localReturnDir, { recursive: true });
  const pathname = path.join(localReturnDir, `${record.returnReference}.json`);
  await fs.writeFile(pathname, JSON.stringify(record, null, 2), "utf8");
  return {
    pathname,
    returnReference: record.returnReference,
    submittedAt: record.submittedAt
  };
}

async function saveReturnToBlob(record) {
  const submittedDate = record.submittedAt.slice(0, 10);
  const pathname = `returns/${submittedDate}/${record.returnReference}.json`;
  const blob = await put(pathname, JSON.stringify(record, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json"
  });
  return {
    pathname: blob.pathname,
    returnReference: record.returnReference,
    submittedAt: record.submittedAt
  };
}

async function saveReturnRequest(request) {
  const record = buildReturnRecord(request);
  if (getOrderStorageMode() === "blob") {
    return saveReturnToBlob(record);
  }
  return saveReturnLocally(record);
}

async function parseBlobJson(pathname) {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const raw = await new Response(result.stream).text();
  return JSON.parse(raw);
}

async function listLocalOrders(limit = 100) {
  try {
    await fs.mkdir(localOrderDir, { recursive: true });
    const files = await fs.readdir(localOrderDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json")).sort().reverse().slice(0, limit);
    const orders = await Promise.all(
      jsonFiles.map(async (file) => {
        const raw = await fs.readFile(path.join(localOrderDir, file), "utf8");
        return JSON.parse(raw);
      })
    );
    return orders.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  } catch {
    return [];
  }
}

async function listBlobOrders(limit = 100) {
  const listing = await list({ prefix: "orders/", limit: Math.min(limit, 200) });
  const sorted = [...listing.blobs].sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, limit);
  const records = await Promise.all(
    sorted.map(async (blob) => {
      try {
        return await parseBlobJson(blob.pathname);
      } catch {
        return null;
      }
    })
  );
  return records.filter(Boolean);
}

async function listLocalReturns(limit = 100) {
  try {
    await fs.mkdir(localReturnDir, { recursive: true });
    const files = await fs.readdir(localReturnDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json")).sort().reverse().slice(0, limit);
    const requests = await Promise.all(
      jsonFiles.map(async (file) => {
        const raw = await fs.readFile(path.join(localReturnDir, file), "utf8");
        return JSON.parse(raw);
      })
    );
    return requests.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  } catch {
    return [];
  }
}

async function listBlobReturns(limit = 100) {
  const listing = await list({ prefix: "returns/", limit: Math.min(limit, 200) });
  const sorted = [...listing.blobs].sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, limit);
  const records = await Promise.all(
    sorted.map(async (blob) => {
      try {
        return await parseBlobJson(blob.pathname);
      } catch {
        return null;
      }
    })
  );
  return records.filter(Boolean);
}

function orderMatchesQuery(record, query) {
  const referenceMatches = String(record.orderReference || "").toUpperCase() === query.orderReference;
  if (!referenceMatches) {
    return false;
  }

  const emailMatches = query.email && sanitizeEmail(record.email) === query.email;
  const transactionMatches = query.paypalTransactionId && sanitizeText(record.paypalTransactionId, 160) === query.paypalTransactionId;
  return Boolean(emailMatches || transactionMatches);
}

async function listOrders(limit = 100) {
  if (getOrderStorageMode() === "blob") {
    return listBlobOrders(limit);
  }
  return listLocalOrders(limit);
}

async function listReturns(limit = 100) {
  if (getOrderStorageMode() === "blob") {
    return listBlobReturns(limit);
  }
  return listLocalReturns(limit);
}

async function findOrder(query) {
  const orders = await listOrders(500);
  const match = orders.find((record) => orderMatchesQuery(record, query));
  return match || null;
}

module.exports = {
  createOrderReference,
  createReturnReference,
  findOrder,
  getDashboardPassword,
  getPublicOrderView,
  isDashboardAuthorized,
  listOrders,
  listReturns,
  normalizeOrderLookupQuery,
  normalizeOrderSubmission,
  normalizeReturnSubmission,
  saveOrder,
  saveReturnRequest,
  updateOrderAfterSalesStatus,
  sendUnauthorized
};
