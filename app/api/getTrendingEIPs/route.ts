// add this to prevent the build command from static generating this page
export const dynamic = "force-dynamic";

import mongoose from "mongoose";
import { subDays } from "date-fns";
import { PageVisit } from "@/models/pageVisit";

export const GET = async () => {
  if (!process.env.MONGODB_URL) {
    return Response.json([]);
  }

  await mongoose.connect(process.env.MONGODB_URL);

  const sevenDaysAgo = subDays(new Date(), 7);
  const trendingCount = 5;

  const topPages = await PageVisit.aggregate([
    {
      $match: {
        timestamp: { $gte: sevenDaysAgo },
      },
    },
    {
      $group: {
        _id: "$eipNo",
        count: { $sum: 1 },
        type: { $first: "$type" }, // Assuming 'type' is a field in the same collection
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $limit: trendingCount,
    },
  ]);

  return Response.json(topPages);
};
