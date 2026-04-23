const config = window.NOORALIS_CONFIG || {};

const galleryMain = document.querySelector("#gallery-main");
const galleryCaption = document.querySelector("#gallery-caption");
const thumbs = document.querySelectorAll(".thumb");

thumbs.forEach((thumb) => {
  thumb.addEventListener("click", () => {
    thumbs.forEach((item) => item.classList.remove("is-active"));
    thumb.classList.add("is-active");
    galleryMain.src = thumb.dataset.image;
    galleryMain.alt = thumb.dataset.caption;
    galleryCaption.textContent = thumb.dataset.caption;
  });
});

document.querySelectorAll(".video-card video").forEach((video) => {
  video.addEventListener("error", () => {
    video.closest(".video-card").classList.add("is-missing");
  });
});

const priceDisplay = document.querySelector("[data-price-display]");
if (priceDisplay && Number.isFinite(config.unitPriceCents)) {
  priceDisplay.textContent = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: config.currency || "USD",
    maximumFractionDigits: 0
  }).format(config.unitPriceCents / 100);
}

const checkoutForm = document.querySelector("#checkout-form");
const checkoutNote = document.querySelector("#checkout-note");
const paypalButtonContainer = document.querySelector("#paypal-button-container");

function getCheckoutPayload() {
  const formData = new FormData(checkoutForm);
  const quantity = Math.max(1, Math.min(20, Number(formData.get("quantity") || 1)));
  return {
    color: formData.get("color"),
    variant: formData.get("variant"),
    quantity,
    email: formData.get("email")
  };
}

function loadPayPalSdk(clientId, currency) {
  return new Promise((resolve, reject) => {
    if (window.paypal) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    const params = new URLSearchParams({
      "client-id": clientId,
      currency,
      intent: "capture",
      components: "buttons"
    });
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Unable to load the PayPal checkout script."));
    document.head.appendChild(script);
  });
}

async function setupPayPalCheckout() {
  try {
    const response = await fetch("/api/paypal/config");
    const paypalConfig = await response.json();

    if (!paypalConfig.configured) {
      checkoutNote.textContent = "PayPal checkout is not configured yet. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET on the server.";
      paypalButtonContainer.classList.add("is-disabled");
      return;
    }

    await loadPayPalSdk(paypalConfig.clientId, paypalConfig.currency || config.currency || "USD");

    window.paypal
      .Buttons({
        style: {
          layout: "vertical",
          color: "gold",
          shape: "rect",
          label: "paypal"
        },
        createOrder: async () => {
          checkoutNote.textContent = "Creating your PayPal order...";
          const orderResponse = await fetch("/api/paypal/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(getCheckoutPayload())
          });
          const orderData = await orderResponse.json();

          if (!orderResponse.ok || !orderData.id) {
            const errorDetail = orderData.details && orderData.details[0];
            throw new Error(errorDetail ? errorDetail.description : orderData.error || "Could not create PayPal order.");
          }

          return orderData.id;
        },
        onApprove: async (data, actions) => {
          checkoutNote.textContent = "Capturing your PayPal payment...";
          const captureResponse = await fetch(`/api/paypal/orders/${data.orderID}/capture`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          });
          const captureData = await captureResponse.json();
          const errorDetail = captureData.details && captureData.details[0];

          if (errorDetail && errorDetail.issue === "INSTRUMENT_DECLINED") {
            return actions.restart();
          }

          if (!captureResponse.ok || errorDetail) {
            throw new Error(errorDetail ? errorDetail.description : captureData.error || "PayPal payment could not be captured.");
          }

          window.location.href = `success.html?paypal_order_id=${encodeURIComponent(data.orderID)}`;
        },
        onCancel: () => {
          checkoutNote.textContent = "Checkout canceled. You can restart PayPal checkout anytime.";
        },
        onError: (error) => {
          checkoutNote.textContent = error.message || "PayPal checkout is temporarily unavailable.";
        }
      })
      .render("#paypal-button-container");
  } catch (error) {
    checkoutNote.textContent = error.message || "PayPal checkout is temporarily unavailable.";
  }
}

checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

setupPayPalCheckout();

const quoteForm = document.querySelector("#quote-form");
const formNote = document.querySelector("#form-note");

quoteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(quoteForm);
  const subject = "Nooralis LED Bionic Butterfly Drone Inquiry";
  const body = [
    `Name: ${data.get("name")}`,
    `Email: ${data.get("email")}`,
    `Event type: ${data.get("event")}`,
    `Quantity: ${data.get("quantity")}`,
    "",
    "Message:",
    data.get("message") || "No additional message provided."
  ].join("\n");

  const email = config.supportEmail || "sales@nooralis.com";
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  formNote.textContent = "Opening your email app with the inquiry details.";
  window.location.href = mailto;
});
