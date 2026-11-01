// Email. v0.1 sends nothing. v0.2: Resend (codes, payment reminders, notes from Jen).
export type EmailKind = "code" | "trial_reminder" | "payment_failed" | "check_in_reminder" | "note";

export interface EmailService {
  readonly kind: "test" | "live";
  send(to: string, kind: EmailKind, data?: Record<string, string>): Promise<{ sent: boolean }>;
}

export const testEmail: EmailService = {
  kind: "test",
  send: async () => ({ sent: false }),
};

export const email: EmailService = testEmail;
