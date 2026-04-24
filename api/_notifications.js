function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(value || "");
  }
}

function getNotificationSettings() {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.NOTIFICATION_EMAIL_FROM || "").trim();
  const merchantTo = String(process.env.NOTIFICATION_EMAIL_TO || "zhannaingdianshang@gmail.com").trim();
  const replyTo = String(process.env.NOTIFICATION_REPLY_TO || merchantTo).trim();
  const sendBuyerConfirmation = parseBoolean(process.env.SEND_BUYER_CONFIRMATION_EMAIL, true);

  return {
    apiKey,
    from,
    merchantTo,
    replyTo,
    sendBuyerConfirmation,
    enabled: Boolean(apiKey && from && merchantTo)
  };
}

async function sendResendEmail(payload, settings = getNotificationSettings()) {
  if (!settings.enabled) {
    return { ok: false, skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: settings.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      reply_to: payload.replyTo || settings.replyTo
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || "Resend email request failed.");
  }

  return {
    ok: true,
    id: data.id || ""
  };
}

function buildOrderMerchantEmail(order) {
  return {
    subject: `New Nooralis order submitted: ${order.orderReference}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #171717;">
        <h2 style="margin-bottom: 12px;">New order details received</h2>
        <p>A customer completed the Nooralis paid-order form.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Reference</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(order.orderReference)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Submitted</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(formatDate(order.submittedAt))}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Buyer</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(order.fullName)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Email</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(order.email)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Phone</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(order.phone)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Product</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(order.variant)} / ${escapeHtml(order.color)} / Qty ${escapeHtml(order.quantity)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Country / city</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(order.country)} / ${escapeHtml(order.city)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Payment method</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(order.paymentMethod || "PayPal.Me")}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Transaction ID</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(order.paypalTransactionId)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Address</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(order.address).replace(/\n/g, "<br>")}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Notes</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(order.notes || "No additional notes.").replace(/\n/g, "<br>")}</td></tr>
        </table>
      </div>
    `
  };
}

function buildOrderBuyerEmail(order) {
  return {
    subject: `Nooralis order details received: ${order.orderReference}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #171717;">
        <h2 style="margin-bottom: 12px;">We received your Nooralis order details</h2>
        <p>Thank you. Your paid-order details are now in the Nooralis order desk.</p>
        <p><strong>Reference:</strong> ${escapeHtml(order.orderReference)}</p>
        <p><strong>Configuration:</strong> ${escapeHtml(order.variant)} / ${escapeHtml(order.color)} / Qty ${escapeHtml(order.quantity)}</p>
        <p><strong>Next step:</strong> We review the submission, match the payment, and then confirm the shipping or production step.</p>
        <p>If you need to follow up, reply to this email with your order reference.</p>
      </div>
    `
  };
}

function buildReturnMerchantEmail(request) {
  return {
    subject: `New Nooralis return request: ${request.returnReference}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #171717;">
        <h2 style="margin-bottom: 12px;">New return / after-sales request</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Return reference</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(request.returnReference)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Order reference</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(request.orderReference)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Buyer</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(request.fullName)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Email</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(request.email)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Reason</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(request.returnReason)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Requested resolution</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(request.requestedResolution)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Item condition</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(request.itemCondition)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ded8cb;"><strong>Issue details</strong></td><td style="padding: 8px; border: 1px solid #ded8cb;">${escapeHtml(request.issueDetails).replace(/\n/g, "<br>")}</td></tr>
        </table>
      </div>
    `
  };
}

function buildReturnBuyerEmail(request) {
  return {
    subject: `Nooralis return request received: ${request.returnReference}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #171717;">
        <h2 style="margin-bottom: 12px;">We received your return / after-sales request</h2>
        <p>Your Nooralis service request is now in review.</p>
        <p><strong>Return reference:</strong> ${escapeHtml(request.returnReference)}</p>
        <p><strong>Order reference:</strong> ${escapeHtml(request.orderReference)}</p>
        <p><strong>Requested resolution:</strong> ${escapeHtml(request.requestedResolution)}</p>
        <p>The team will review the request and contact you with the next step.</p>
      </div>
    `
  };
}

async function notifyOrderSubmission(order) {
  const settings = getNotificationSettings();
  if (!settings.enabled) {
    return { enabled: false, merchantSent: false, buyerSent: false };
  }

  let merchantSent = false;
  let buyerSent = false;

  const merchantEmail = buildOrderMerchantEmail(order);
  await sendResendEmail(
    {
      to: [settings.merchantTo],
      subject: merchantEmail.subject,
      html: merchantEmail.html
    },
    settings
  );
  merchantSent = true;

  if (settings.sendBuyerConfirmation && order.email) {
    const buyerEmail = buildOrderBuyerEmail(order);
    await sendResendEmail(
      {
        to: [order.email],
        subject: buyerEmail.subject,
        html: buyerEmail.html
      },
      settings
    );
    buyerSent = true;
  }

  return {
    enabled: true,
    merchantSent,
    buyerSent
  };
}

async function notifyReturnSubmission(request) {
  const settings = getNotificationSettings();
  if (!settings.enabled) {
    return { enabled: false, merchantSent: false, buyerSent: false };
  }

  let merchantSent = false;
  let buyerSent = false;

  const merchantEmail = buildReturnMerchantEmail(request);
  await sendResendEmail(
    {
      to: [settings.merchantTo],
      subject: merchantEmail.subject,
      html: merchantEmail.html
    },
    settings
  );
  merchantSent = true;

  if (settings.sendBuyerConfirmation && request.email) {
    const buyerEmail = buildReturnBuyerEmail(request);
    await sendResendEmail(
      {
        to: [request.email],
        subject: buyerEmail.subject,
        html: buyerEmail.html
      },
      settings
    );
    buyerSent = true;
  }

  return {
    enabled: true,
    merchantSent,
    buyerSent
  };
}

module.exports = {
  getNotificationSettings,
  notifyOrderSubmission,
  notifyReturnSubmission
};
