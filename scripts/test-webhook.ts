// pnpm tsx scripts/test-webhook.ts
import crypto from "crypto";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config({ path: ".env.local" });

async function testWebhook() {
  // Webhook data to test
  const webhookData = {
    type: "cast.created",
    data: {
      text: "Ethereum's next network upgrade, Pectra, is coming to mainnet on May 7th, at epoch 364032 🎉\n\nPectra introduces EIP-7702, several improvements to validator UX, a doubling of the blob count (.oO!) and many other features! \n\nSee the full announcement here:",
      hash: "0xc95bfb03d740900ad2d38c934e5e306843e765d1", // https://warpcast.com/tim/0xc95bfb03
    },
  };

  const rawBody = JSON.stringify(webhookData);

  // Get webhook secret from env
  const webhookSecret = process.env.NEYNAR_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("NEYNAR_WEBHOOK_SECRET not set in environment variables");
  }

  // Create signature using the same method as in the webhook verification
  const encoder = new TextEncoder();
  const keyData = encoder.encode(webhookSecret);
  const messageData = encoder.encode(rawBody);

  // Create HMAC using Web Crypto API
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );

  const signatureArray = await crypto.subtle.sign("HMAC", key, messageData);

  // Convert to hex string
  const signature = Array.from(new Uint8Array(signatureArray))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Make the webhook request
  try {
    const response = await axios.post(
      "https://eip.tools/api/webhook",
      webhookData,
      {
        headers: {
          "Content-Type": "application/json",
          "x-neynar-signature": signature,
        },
      }
    );

    console.log("Response status:", response.status);
    console.log("Response data:", response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Error testing webhook:",
        error.response?.data || error.message
      );
    } else {
      console.error("Error testing webhook:", error);
    }
  }
}

// Run the test
testWebhook();
