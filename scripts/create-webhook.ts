// pnpm tsx scripts/create-webhook.ts
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY as string;
const WEBHOOK_URL = process.env.WEBHOOK_URL as string;

if (!NEYNAR_API_KEY) {
  throw new Error("NEYNAR_API_KEY is not set in .env file");
}

if (!WEBHOOK_URL) {
  throw new Error("WEBHOOK_URL is not set in .env file");
}

// Initialize Neynar client
const config = new Configuration({
  apiKey: NEYNAR_API_KEY,
});
const client = new NeynarAPIClient(config);

async function createWebhook() {
  try {
    const webhook = await client.publishWebhook({
      name: "eip-tools-webhook",
      url: WEBHOOK_URL,
      subscription: {
        "cast.created": {
          // This regex pattern matches:
          // - ERC or EIP case-insensitively
          // - Can have any text before or after
          text: "(?i)\b(eip|erc)(\b|[-d])",
        },
      },
    });

    console.log("Webhook created successfully:", webhook);
  } catch (error) {
    console.error("Error creating webhook:", error);
  }
}

createWebhook();
