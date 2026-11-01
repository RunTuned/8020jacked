import { describe, expect, it } from "vitest";
import { auth, billing, email } from "..";

describe("v0.1 test services", () => {
  it("auth: no account; progress stays on this phone", async () => {
    expect(auth.kind).toBe("test");
    expect(auth.notice).toBe("Test version: no account needed. Your progress stays on this phone.");
    expect(await auth.currentUser()).toBeNull();
    expect((await auth.sendCode("x@example.com")).ok).toBe(false);
  });

  it('billing: "Test version, free", no pay page, never locked', async () => {
    expect(billing.label).toBe("Test version, free");
    expect(await billing.checkoutUrl("yearly")).toBeNull();
    expect(await billing.locked()).toBe(false);
  });

  it("email: nothing is sent", async () => {
    expect((await email.send("x@example.com", "code")).sent).toBe(false);
  });
});
