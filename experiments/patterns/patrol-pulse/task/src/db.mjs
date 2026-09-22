/**
 * A fixed-size connection pool. A caller waits up to `waitMs` for a free
 * connection; past that the request fails with 503 rather than queueing forever.
 */
export const POOL_SIZE = 20;
const WAIT_MS = 5000;

const pool = { busy: 0, waiting: [] };

export async function withConnection(fn) {
  const conn = await acquire();
  try {
    return await fn(conn);
  } finally {
    release(conn);
  }
}

async function acquire() {
  if (pool.busy < POOL_SIZE) {
    pool.busy += 1;
    return { query: async () => [] };
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pool.waiting = pool.waiting.filter((w) => w.resolve !== resolve);
      reject(Object.assign(new Error(`db pool exhausted: ${POOL_SIZE}/${POOL_SIZE} connections busy, waited ${WAIT_MS}ms`), { status: 503 }));
    }, WAIT_MS);
    pool.waiting.push({ resolve, timer });
  });
}

function release() {
  const next = pool.waiting.shift();
  if (next) {
    clearTimeout(next.timer);
    next.resolve({ query: async () => [] });
  } else {
    pool.busy -= 1;
  }
}
