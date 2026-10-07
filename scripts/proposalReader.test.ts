import assert from "node:assert/strict";
import { test } from "node:test";
import * as content from "../utils/proposalContent.server";

test("reader rejects unknown and malformed identifiers without upstream IO", () => {
  assert.equal(typeof content.requireProposalReader, "function", "reader identity guard missing");
  for (const kind of ["eip", "rip", "caip"] as const) {
    for (const id of ["999999999999", "nope", "constructor", "2junk", "1234567890123"]) {
      assert.throws(() => content.requireProposalReader(kind, id), { message: "NEXT_NOT_FOUND" });
    }
  }
});

test("known identities remain valid during upstream outages, including filename and padding variants", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    for (const [kind, id] of [["eip", "4337"], ["eip", "eip-4337.md"], ["eip", "010101"], ["eip", "10101"], ["rip", "7212"], ["caip", "2"], ["eip", "8287"]] as const) {
      assert.ok(content.requireProposalReader(kind, id).proposal);
    }
    await assert.rejects(content.getProposalContent("eip", "8287", {
      resolve: async (_kind, proposal) => proposal,
      remote: async () => { throw new Error("offline"); },
    }), /unavailable/);
    assert.ok(content.requireProposalReader("eip", "8287").proposal, "total source failure is not evidence of an unknown proposal");
  } finally { globalThis.fetch = previous; }
});
