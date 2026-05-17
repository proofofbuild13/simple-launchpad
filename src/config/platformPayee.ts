// Platform payee details for manual MVP commission collection.
// Replace these with real values when going live; later this whole file can be
// dropped once we move to Razorpay Route / Stripe Connect.
export const PLATFORM_PAYEE = {
  name: "proof_of_Build Platform",
  upiId: "yourida@upi",
  bankName: "HDFC Bank",
  accountName: "proof_of_Build Technologies Pvt Ltd",
  accountNumber: "50100123456789",
  ifsc: "HDFC0001234",
};

export const COMMISSION_RATE = 0.15;
