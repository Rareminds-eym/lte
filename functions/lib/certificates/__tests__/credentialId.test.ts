import { expect, it, vi } from "vitest";
import { generateCredentialId, isValidCredentialId } from "../credentialId";

it("creates 80-bit Crockford credentials using secure randomness", () => {
  const random = vi.spyOn(crypto, "getRandomValues");
  const ids = Array.from({ length: 500 }, generateCredentialId);
  expect(new Set(ids).size).toBe(500);
  expect(ids.every(isValidCredentialId)).toBe(true);
  expect(random.mock.calls[0]?.[0].byteLength).toBe(10);
  for (const id of ["LTE-000000000000000I", "lte-0123456789ABCDEF", "LTE-1"])
    expect(isValidCredentialId(id)).toBe(false);
  random.mockRestore();
});
