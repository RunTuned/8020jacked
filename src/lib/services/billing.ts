// Subscriptions. v0.1: "Test version, free" — real price copy shown as a preview, no pay button.
// v0.2: Dodo Payments.
export type BillingState = "test" | "free_week" | "active" | "payment_failed" | "ended";

export interface BillingService {
  readonly kind: "test" | "live";
  readonly label: string;
  state(): Promise<BillingState>;
  /** Pay page URL, or null when there is no paying in this version. */
  checkoutUrl(plan: "monthly" | "yearly"): Promise<string | null>;
  cancel(): Promise<{ ok: boolean }>;
  /** Plan ended → Train, Food and Today show the locked card. Never in the test version. */
  locked(): Promise<boolean>;
}

export const PRICE_PREVIEW = {
  monthly: "$10 a month",
  yearly: "$70 a year",
} as const;

export const testBilling: BillingService = {
  kind: "test",
  label: "Test version, free",
  state: async () => "test",
  checkoutUrl: async () => null,
  cancel: async () => ({ ok: true }),
  locked: async () => false,
};

export const billing: BillingService = testBilling;
