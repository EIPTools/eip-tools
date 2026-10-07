// Test-only: launch next start with --import and a cold fetch cache.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (['raw.githubusercontent.com', 'api.github.com'].includes(url.hostname)) {
    return Promise.reject(new Error('Forced proposal upstream outage'));
  }
  return originalFetch(input, init);
};
