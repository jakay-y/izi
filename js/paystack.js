/**
 * Paystack inline popup (frontend only).
 * Public key is safe to use in the browser.
 * Never put PAYSTACK_SECRET_KEY in this file — verify payments server-side later.
 */

// Edit these later as needed
const PAYSTACK_PUBLIC_KEY = "pk_test_cfd9e2fa94ded703427fbbbc1681f97b6946c9b8";
const PAYSTACK_EMAIL = "customer@example.com"; // change before going live
const PAYSTACK_AMOUNT_KOBO = 500000; // ₦5,000.00 (amount is always in kobo)

function payWithPaystack() {
  if (typeof PaystackPop === "undefined") {
    console.error("Paystack script failed to load.");
    alert("Payment is unavailable right now. Please try again.");
    return;
  }

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: PAYSTACK_EMAIL,
    amount: PAYSTACK_AMOUNT_KOBO,
    currency: "NGN",
    ref: "IZI-" + Date.now(),
    callback: function (response) {
      // response.reference is the payment reference from Paystack
      console.log("Paystack reference:", response.reference);
      alert("Payment successful");
    },
    onClose: function () {
      // User closed the popup without completing payment
      console.log("Paystack popup closed");
    },
  });

  handler.openIframe();
}

document.addEventListener("DOMContentLoaded", function () {
  const payButton = document.getElementById("pay-button");
  if (payButton) {
    payButton.addEventListener("click", function (e) {
      e.preventDefault();
      payWithPaystack();
    });
  }
});
