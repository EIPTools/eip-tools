import { NextResponse } from "next/server";
import { validEIPsArray } from "@/data/validEIPs";
import neynarClient from "@/app/lib/neynar";
import crypto from "crypto";

interface WebhookData {
  type: string;
  data: {
    text: string;
    hash: string;
  };
}

export async function POST(req: Request) {
  try {
    // Get the signature from header
    const signature = req.headers.get("x-neynar-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature header" },
        { status: 401 }
      );
    }

    // Get the raw request body as a string
    const rawBody = await req.text();

    // Create signature using shared secret
    const webhookSecret = process.env.NEYNAR_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("NEYNAR_WEBHOOK_SECRET not set in environment variables");
    }

    const hmac = crypto.createHmac("sha512", webhookSecret);
    const computedSignature = hmac.update(rawBody).digest("hex");

    // Compare signatures
    if (signature !== computedSignature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse the body after verification
    const body = JSON.parse(rawBody) as WebhookData;

    if (body.type === "cast.created") {
      const text = body.data.text;
      const originalCastHash = body.data.hash;

      // Match patterns for numbers with optional EIP/ERC prefix
      const pattern = /(?:eip[-\s]?(\d+)|erc[-\s]?(\d+)|(?<!\S)(\d+)(?!\S))/gi;

      const urls: string[] = [];
      let match;

      while ((match = pattern.exec(text)) !== null) {
        // match[1] = EIP number, match[2] = ERC number, match[3] = standalone number
        const number = match[1] || match[2] || match[3];

        // Only add URL if the number exists in validEIPs
        if (validEIPsArray.includes(number)) {
          urls.push(`https://eip.tools/eip/${number}`);
        }
      }

      if (urls.length > 0) {
        if (!process.env.NEYNAR_SIGNER_UUID) {
          throw new Error(
            "Make sure you set NEYNAR_SIGNER_UUID in your .env file"
          );
        }

        // Create the reply text with URLs
        const replyText = `Explore the EIPs / ERCs mentioned in this cast:\n\n${urls.join("\n")}`;

        // Post the reply using Neynar client
        const reply = await neynarClient.publishCast({
          signerUuid: process.env.NEYNAR_SIGNER_UUID,
          text: replyText,
          parent: originalCastHash,
        });

        console.log("Posted reply:", reply.cast);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
