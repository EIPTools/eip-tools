import assert from "node:assert/strict";
import test from "node:test";
import { getBaseUrl, getMetadata } from "../utils/index";

test("public metadata has a stable canonical, complete OG and absolute image without HOST", () => {
  const previous = process.env.HOST;
  delete process.env.HOST;
  try {
    const metadata = getMetadata({ title: "All EIPs | EIP.tools", description: "Browse Ethereum proposals.", images: "/og/index.png", pathname: "/eips" });
    assert.equal(getBaseUrl(), "https://eip.tools");
    assert.equal(metadata.alternates?.canonical, "https://eip.tools/eips");
    assert.equal(metadata.openGraph?.url, "https://eip.tools/eips");
    assert.equal(metadata.openGraph?.siteName, "EIP.tools");
    assert.deepEqual(metadata.openGraph?.images, "https://eip.tools/og/index.png");
    assert.equal(metadata.description, "Browse Ethereum proposals.");
  } finally {
    if (previous === undefined) delete process.env.HOST;
    else process.env.HOST = previous;
  }
});
