/**
 * The orders API. Routes are a table so the tests can check them without a socket.
 */
import { withConnection } from "./db.mjs";
import { verifyWebhook } from "./payments.mjs";

export const routes = [
  ["GET", "/orders", listOrders],
  ["GET", "/orders/:id", getOrder],
  ["POST", "/orders", createOrder],
  ["GET", "/reports", reports],
  ["POST", "/webhooks/payments", paymentsWebhook],
  ["GET", "/health", health],
];

export function route(method, path) {
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const re = new RegExp(`^${pattern.replace(/:[a-z]+/g, "([^/]+)")}$`);
    if (re.test(path)) return handler;
  }
  return null;
}

async function listOrders(req) {
  return withConnection((conn) => conn.query("select * from orders where account_id = $1 order by created_at desc limit 50", [req.account]));
}

async function getOrder(req) {
  return withConnection((conn) => conn.query("select * from orders where id = $1", [req.params.id]));
}

async function createOrder(req) {
  return withConnection((conn) => conn.query("insert into orders (account_id, total_cents) values ($1, $2) returning *", [req.account, req.body.total_cents]));
}

async function reports(req) {
  return withConnection((conn) => conn.query("select date_trunc('day', created_at) d, sum(total_cents) from orders where account_id = $1 group by d", [req.account]));
}

async function paymentsWebhook(req) {
  if (!verifyWebhook(req.rawBody, req.headers["x-signature"])) throw Object.assign(new Error("webhook signature mismatch"), { status: 400 });
  return { received: true };
}

async function health() {
  return { ok: true };
}
