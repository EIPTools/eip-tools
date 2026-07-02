// add this to prevent the build command from static generating this page
export const dynamic = "force-dynamic";

import mongoose from "mongoose";
import { PageVisit } from "@/models/pageVisit";
import { LogPageVisitRequest, logPageVisitRequestSchema } from "@/data/schemas";

export const POST = async (request: Request) => {
  // validate request body
  let body: LogPageVisitRequest;
  try {
    const requestBody = await request.json();
    body = logPageVisitRequestSchema.parse(requestBody);
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const eipNo = body.eipNo;
  const type = body.type;

  if (!process.env.MONGODB_URL) {
    return new Response(null, { status: 204 });
  }

  await mongoose.connect(process.env.MONGODB_URL);

  const pageVisit = new PageVisit({
    eipNo,
    type,
  });
  await pageVisit.save();

  return new Response("Page visit logged", { status: 200 });
};
