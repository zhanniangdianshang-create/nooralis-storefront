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
const checkoutActionContainer = document.querySelector("#checkout-action-container");
const checkoutProviderName = document.querySelector("#checkout-provider-name");
const checkoutProviderCopy = document.querySelector("#checkout-provider-copy");
const paymentBadges = document.querySelector("#payment-badges");
const quoteForm = document.querySelector("#quote-form");
const formNote = document.querySelector("#form-note");

let handleCheckoutSubmit = () => {
  checkoutNote.textContent = "Checkout is still loading. Please wait a moment.";
};

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

function renderPaymentBadges(badges = []) {
  paymentBadges.innerHTML = "";
  badges.forEach((badge) => {
    const element = document.createElement("span");
    element.textContent = badge;
    paymentBadges.appendChild(element);
  });
}

function updateCheckoutSummary(settings) {
  checkoutProviderName.textContent = settings.providerName || "Secure checkout";
  checkoutProviderCopy.textContent = settings.note || "We are preparing the best payment route for your region.";
}

function renderCheckoutButton(label) {
  checkoutActionContainer.innerHTML = "";
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "primary-button checkout-button";
  button.textContent = label;
  checkoutActionContainer.appendChild(button);
  return button;
}

function scrollToQuote() {
  const quoteSection = document.querySelector("#quote");
  if (quoteSection) {
    quoteSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function rememberCheckoutDraft(payload, providerName) {
  try {
    window.sessionStorage.setItem(
      "nooralisCheckoutDraft",
      JSON.stringify({
        ...payload,
        provider: providerName,
        createdAt: new Date().toISOString()
      })
    );
  } catch {
    // Ignore storage issues for private browsing or restricted environments.
  }
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

async function setupPayPalCheckout(settings) {
  const paypalClientId = settings.paypal && settings.paypal.clientId;
  checkoutActionContainer.innerHTML = "";
  const paypalSlot = document.createElement("div");
  paypalSlot.className = "checkout-action-slot";
  paypalSlot.id = "paypal-button-container";
  checkoutActionContainer.appendChild(paypalSlot);

  if (!settings.configured || !paypalClientId) {
    checkoutNote.textContent = settings.note || "PayPal checkout is not configured right now.";
    handleCheckoutSubmit = () => {
      checkoutNote.textContent = "PayPal is unavailable right now. Use the quote form below for a secure invoice.";
      scrollToQuote();
    };
    return;
  }

  await loadPayPalSdk(paypalClientId, settings.currency || config.currency || "USD");

  handleCheckoutSubmit = () => {
    checkoutNote.textContent = "Use the PayPal button below to complete checkout.";
  };

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
    .render(paypalSlot);
}

function setupHostedCheckout(settings) {
  if (!settings.configured || !settings.checkoutUrl) {
    renderCheckoutButton("Request a Secure Invoice");
    handleCheckoutSubmit = () => {
      checkoutNote.textContent = settings.note || "Hosted card checkout is still being activated.";
      scrollToQuote();
    };
    return;
  }

  renderCheckoutButton(settings.actionLabel || "Continue to Secure Card Checkout");
  checkoutNote.textContent = settings.note || "";

  handleCheckoutSubmit = () => {
    const payload = getCheckoutPayload();

    if (settings.singleUnitOnly && payload.quantity !== 1) {
      checkoutNote.textContent = `${settings.providerName} checkout is currently set for one kit per payment. Use the quote form below for multiple units.`;
      scrollToQuote();
      return;
    }

    rememberCheckoutDraft(payload, settings.providerName);
    checkoutNote.textContent = `Opening ${settings.providerName} secure checkout...`;

    if (settings.openInNewTab === false) {
      window.location.href = settings.checkoutUrl;
      return;
    }

    window.open(settings.checkoutUrl, "_blank", "noopener,noreferrer");
  };
}

function setupManualCheckout(settings) {
  renderCheckoutButton(settings.actionLabel || "Request a Secure Invoice");
  checkoutNote.textContent = settings.note || "";
  handleCheckoutSubmit = () => {
    checkoutNote.textContent =
      settings.note || "Online card checkout is temporarily unavailable. Use the quote form below for a secure invoice.";
    scrollToQuote();
  };
}

async function setupCheckout() {
  try {
    const response = await fetch("/api/checkout/config");
    const settings = await response.json();

    if (!response.ok) {
      throw new Error(settings.error || "Could not load checkout settings.");
    }

    updateCheckoutSummary(settings);
    renderPaymentBadges(settings.badges);

    if (settings.provider === "paypal") {
      await setupPayPalCheckout(settings);
      return;
    }

    if (settings.provider === "hosted_link") {
      setupHostedCheckout(settings);
      return;
    }

    setupManualCheckout(settings);
  } catch (error) {
    updateCheckoutSummary({
      providerName: "Sales invoice",
      note: "Online card checkout is temporarily unavailable. Use the quote form below for a secure invoice."
    });
    renderPaymentBadges(["Secure inquiry", "Custom event support", "Global shipping"]);
    setupManualCheckout({
      actionLabel: "Request a Secure Invoice",
      note: error.message || "Secure checkout is temporarily unavailable."
    });
    checkoutNote.textContent = error.message || "Secure checkout is temporarily unavailable.";
  }
}

checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleCheckoutSubmit();
});

setupCheckout();

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
