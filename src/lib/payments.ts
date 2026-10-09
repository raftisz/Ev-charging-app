/** Payment methods as the API names them, and how the UI labels them. */
export const PAYMENT_METHODS = ["WALLET", "CREDIT_CARD", "PROMPTPAY"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  WALLET: "Volt Grid wallet",
  CREDIT_CARD: "Credit card",
  PROMPTPAY: "PromptPay QR",
};

/** Older clients send the label rather than the code. */
export const METHOD_FROM_LABEL: Record<string, PaymentMethod> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [PAYMENT_METHOD_LABEL[m], m]),
);

/** Money is stored as a float of baht; keep it to whole satang. */
export const toSatang = (amount: number) => Math.round(amount * 100) / 100;
