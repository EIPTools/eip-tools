import { NextResponse } from "next/server";
import { validEIPsArray } from "@/data/validEIPs";
import neynarClient from "@/app/lib/neynar";
import crypto from "crypto";

// Define allowed methods
export const dynamic = "force-dynamic";

interface WebhookData {
  type: string;
  data: {
    text: string;
    hash: string;
  };
}

// This is required to handle OPTIONS requests from CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      Allow: "POST",
    },
  });
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

    // Convert webhook secret to Uint8Array
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

    const signature_array = await crypto.subtle.sign("HMAC", key, messageData);

    // Convert to hex string
    const computedSignature = Array.from(new Uint8Array(signature_array))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

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

        // Create the reply text based on number of URLs
        let replyText = "More EIPs / ERCs mentioned in this cast:";
        if (urls.length >= 2) {
          const additionalUrls = urls.slice(1);
          replyText += `\n\n${additionalUrls.join("\n")}`;
        }

        // Post the reply using Neynar client
        const reply = await neynarClient.publishCast({
          signerUuid: process.env.NEYNAR_SIGNER_UUID,
          text: replyText,
          embeds: [
            {
              url: urls[0],
            },
          ],
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
