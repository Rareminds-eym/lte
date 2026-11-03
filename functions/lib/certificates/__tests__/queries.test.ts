import { expect, it } from "vitest";
import {
  certificateFinalizeAtomicPolicy,
  certificateIssuePolicy,
  certificatePdfUpdatePolicy,
  readAll,
} from "../queries";
import { gateway } from "./fixtures";

it("keeps issuance/finalization atomic and derives owner IDs from authenticated context", () => {
  expect(certificateIssuePolicy.operation).toBe("rpc");
  expect(certificateFinalizeAtomicPolicy.operation).toBe("rpc");
  expect(certificateIssuePolicy.ownership).toMatchObject({
    arg: "p_user_id",
    source: "authenticatedUserId",
    required: true,
  });
  expect(certificatePdfUpdatePolicy.filters).toContain("pdf_object_key");
});
it("does not silently omit rows at the server pagination cap", async () => {
  const { qb, read } = gateway();
  read
    .mockResolvedValueOnce(Array.from({ length: 100 }, (_, id) => ({ id })))
    .mockResolvedValueOnce([{ id: 100 }]);
  expect(
    await readAll(
      qb,
      { table: "certificates", operation: "read", columns: ["id"], maxPageSize: 100 },
      {},
    ),
  ).toHaveLength(101);
  expect(read.mock.calls[1]?.[1].page).toBe(2);
});
