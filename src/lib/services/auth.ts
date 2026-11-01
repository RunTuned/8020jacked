// Accounts. v0.1: no account; progress stays on this phone. v0.2: Supabase email codes.
export interface AuthService {
  readonly kind: "test" | "live";
  /** Copy for the account screens (A10, A11, A14c cut). */
  readonly notice: string;
  currentUser(): Promise<{ id: string; email: string } | null>;
  sendCode(email: string): Promise<{ ok: boolean; reason?: string }>;
  verifyCode(email: string, code: string): Promise<{ ok: boolean; reason?: string }>;
  signOut(): Promise<void>;
}

export const testAuth: AuthService = {
  kind: "test",
  notice: "Test version: no account needed. Your progress stays on this phone.",
  currentUser: async () => null,
  sendCode: async () => ({ ok: false, reason: "test_version" }),
  verifyCode: async () => ({ ok: false, reason: "test_version" }),
  signOut: async () => {},
};

export const auth: AuthService = testAuth;
