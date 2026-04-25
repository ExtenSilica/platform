import { describe, it, expect } from "vitest";
import {
  createPendingExchange,
  consumePendingExchange,
} from "../src/lib/oauthPendingExchange";

describe("oauthPendingExchange (replay safety)", () => {
  const user = {
    id: 1,
    username: "alice",
    email: "alice@example.com",
    bio: null,
    avatarUrl: null,
    createdAt: new Date(0).toISOString(),
  };

  it("second consume with the same code returns null (one-time handoff)", () => {
    const code = createPendingExchange("token-a", user, false);
    const first = consumePendingExchange(code);
    expect(first).not.toBeNull();
    expect(first?.token).toBe("token-a");
    expect(consumePendingExchange(code)).toBeNull();
  });

  it("rejects empty code", () => {
    expect(consumePendingExchange("")).toBeNull();
    expect(consumePendingExchange("   ")).toBeNull();
  });
});
