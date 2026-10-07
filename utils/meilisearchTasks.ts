export async function verifyIndexSwap(
  waitForTask: () => Promise<void>,
  readLiveMetadata: () => Promise<{ createdAt: string }>,
  expectedCreatedAt: string,
  timeoutMs = 15 * 60 * 1000,
) {
  if (!expectedCreatedAt) throw new Error("Missing staging index identity");
  try { await waitForTask(); return; }
  catch (error) {
    // Global swap tasks are hidden from index-scoped API keys. A swap moves
    // metadata too: the staging creation timestamp identifies this exact build.
    if (!(error instanceof Error) || !error.message.includes("404 task_not_found")) throw error;
  }
  const deadline = Date.now() + timeoutMs;
  do {
    const live = await readLiveMetadata();
    if (live.createdAt === expectedCreatedAt) return;
    if (Date.now() >= deadline) break;
    await new Promise(resolve => setTimeout(resolve, 750));
  } while (Date.now() < deadline);
  throw new Error("Could not verify index swap; inspect the swap task with an administrative key");
}
