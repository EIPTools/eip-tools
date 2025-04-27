import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

if (!process.env.NEYNAR_API_KEY) {
  throw new Error("Make sure you set NEYNAR_API_KEY in your .env file");
}

const config = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY,
});

const neynarClient = new NeynarAPIClient(config);

export default neynarClient;
