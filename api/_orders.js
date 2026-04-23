const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { get, list, put } = require("@vercel/blob");
const { sendJson } = require("./_paypal");

const allowedColors = new Set(["Golden", "Pink-Purple", "Blue", "Red", "Custom color inquiry"]);
const allowedVariants = new Set(["LED performance version", "Standard non-LED version"]);
const localOrderDir = path.join(__dirname, "..", ".data", "orders");

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
  const email = sanitizeText(body.email, 160).toLowerCase();
  const phone = sanitizeText(body.phone, 80);
  const country = sanitizeText(body.country, 80);
  const city = sanitizeText(body.city, 80);
  const postalCode = sanitizeText(body.postalCode, 40);
  const address = sanitizeMultilineText(body.address, 500);
  const paypalPayerEmail = sanitizeText(body.paypalPayerEmail, 160).toLowerCase();
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

function getOrderStorageMode() {
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}

function buildOrderRecord(order) {
  return {
    ...order,
    submittedAt: new Date().toISOString()
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

async function listOrders(limit = 100) {
  if (getOrderStorageMode() === "blob") {
    return listBlobOrders(limit);
  }
  return listLocalOrders(limit);
}

module.exports = {
  createOrderReference,
  getDashboardPassword,
  isDashboardAuthorized,
  listOrders,
  normalizeOrderSubmission,
  saveOrder,
  sendUnauthorized
};
