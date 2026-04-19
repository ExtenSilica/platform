import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@prisma/client";

vi.mock("../src/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../src/db";
import { allocateUniqueUsername } from "../src/services/oauthUserService";

describe("allocateUniqueUsername (collision safety)", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it("uses a suffixed username when the base is already taken", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: 99 } as User)
      .mockResolvedValue(null);
    const name = await allocateUniqueUsername("alice", "gh");
    expect(name).not.toBe("alice");
    expect(name.length).toBeLessThanOrEqual(32);
    expect(name).toMatch(/^[a-z0-9_-]+$/);
  });

  it("returns base when available", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const name = await allocateUniqueUsername("bob", "gh");
    expect(name).toBe("bob");
  });
});
