import { getProposalContent } from "@/utils/proposalContent.server";
// add this to prevent the build command from static generating this page
export const dynamic = "force-dynamic";

import mongoose from "mongoose";
import OpenAI from "openai";

import { AISummary } from "@/models/aiSummary";
import { AISummaryRequest, AISummaryRequestSchema } from "@/data/schemas";
import { validEIPs } from "@/data/validEIPs";
import { validRIPs } from "@/data/validRIPs";
import { validCAIPs } from "@/data/validCAIPs";
import { EIPStatus } from "@/utils";

const openai = new OpenAI({
  organization: process.env.OPENAI_ORG_ID,
  project: null, // Default Project
  apiKey: process.env.OPENAI_API_KEY,
});

export const POST = async (request: Request) => {
  // validate request body
  let body: AISummaryRequest;
  try {
    const requestBody = await request.json();
    body = AISummaryRequestSchema.parse(requestBody);
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const eipNo = body.eipNo;
  const type = body.type ?? "EIP";

  await mongoose.connect(process.env.MONGODB_URL!);

  // query "summaries" mongodb for this eipNo
  const summaryRes = await AISummary.findOne({ eipNo });

  // If summary exists, return
  if (summaryRes) {
    return new Response(JSON.stringify(summaryRes.summary), {
      status: 200,
    });
  }

  // If not, then send EIP markdown to chatgpt api
  const { status } =
    type === "RIP"
      ? validRIPs[eipNo]
      : type === "CAIP"
      ? validCAIPs[eipNo]
      : validEIPs[eipNo];
  const content = await getProposalContent(type === "RIP" ? "rip" : type === "CAIP" ? "caip" : "eip", eipNo).catch(() => null);
  if (!content) return Response.json({ error: "Proposal temporarily unavailable" }, { status: 503 });
  const markdown = content.markdown;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `Summarize the following EIP/ERC no: ${eipNo} into easy to understand & just in few lines.
Don't start with any other extra stuff, only output concise 4-6 lines. I need to directly display this output on a website.
Here's the markdown to summarize:
${markdown}`,
        },
      ],
      stream: true,
    });

    let response = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      response += content;
    }

    // save the response in mongodb
    await AISummary.create({
      eipNo,
      summary: response,
      eipStatus: status,
      timestamp: new Date(),
    });

    // return string summary
    return new Response(JSON.stringify(response), {
      status: 200,
    });
  } catch (e) {
    // send error
    return new Response(JSON.stringify(e), { status: 500 });
  }
};
