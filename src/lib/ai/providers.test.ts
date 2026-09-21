import { describe, expect, it, vi } from "vitest";

import { reuseUntilExpiry } from "./providers";

const HOUR = 60 * 60_000;

function credentialsExpiringAt(time: number) {
  return {
    accessKeyId: "id",
    secretAccessKey: "secret",
    expiration: new Date(time),
  };
}

describe("reuseUntilExpiry", () => {
  it("borrows credentials once and reuses them", async () => {
    const source = vi.fn(async () => credentialsExpiringAt(HOUR));
    const credentials = reuseUntilExpiry(source, () => 0);

    await credentials();
    await credentials();

    expect(source).toHaveBeenCalledOnce();
  });

  it("borrows a new set shortly before the old one expires", async () => {
    let now = 0;
    const source = vi.fn(async () => credentialsExpiringAt(now + HOUR));
    const credentials = reuseUntilExpiry(source, () => now);

    await credentials();
    now = HOUR - 60_000;
    await credentials();

    expect(source).toHaveBeenCalledTimes(2);
  });

  it("tries again after a failed attempt", async () => {
    const source = vi
      .fn()
      .mockRejectedValueOnce(new Error("sso session expired"))
      .mockResolvedValue(credentialsExpiringAt(HOUR));
    const credentials = reuseUntilExpiry(source, () => 0);

    await expect(credentials()).rejects.toThrow("sso session expired");
    await expect(credentials()).resolves.toMatchObject({ accessKeyId: "id" });
  });
});
