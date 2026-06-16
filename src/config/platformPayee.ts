// Platform payee details for manual MVP commission collection.
// Replace these with real values when going live; later this whole file can be
// dropped once we move to Razorpay Route / Stripe Connect.
export const PLATFORM_PAYEE = {
  name: "ProofBuild Platform",
  upiId: "9487367324@ybl",
  bankName: "HDFC Bank",
  accountName: "ProofBuild Technologies Pvt Ltd",
  accountNumber: "50100123456789",
  ifsc: "HDFC0001234",
};

export const COMMISSION_RATE = 0.15;
