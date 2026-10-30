// Turn8digital API (one file). Photos + booking requests.
//   PUBLIC  GET  /api/gallery            list of uploaded photos (newest first)
//   PUBLIC  GET  /api/image/<id>         one photo
//   PUBLIC  POST /api/book               a visitor sends a booking request
//   ADMIN   POST /api/auth-check         checks the admin password
//   ADMIN   POST /api/upload             adds a photo
//   ADMIN   POST /api/delete             removes a photo
//   ADMIN   GET  /api/bookings           list booking requests
//   ADMIN   POST /api/booking-update     change a request's status / add a note
//   ADMIN   POST /api/booking-delete     delete a request
//   ADMIN   POST /api/test-email         sends a test notification email
// Settings live in Netlify environment variables:
//   ADMIN_PASSWORD  (required)        RESEND_API_KEY + NOTIFY_EMAIL  (for email alerts)
//   FROM_EMAIL      (optional, defaults to Resend's test sender)
import { createHash, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const CATEGORIES = ["website", "event", "design", "other"];
const MAX_BYTES = 4.5 * 1024 * 1024; // Netlify caps request bodies at ~6 MB
const ID = /^[a-f0-9-]{36}$/;
const SERVICES = {
  web: "Web development",
  refresh: "Refresh & fixes",
  care: "Ongoing care",
  events: "Event coverage",
  design: "Graphic design",
};
const STATUSES = ["new", "contacted", "confirmed", "done", "declined"];

const store = () => getStore({ name: "gallery", consistency: "strong" });

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

function isAuthorized(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const header = req.headers.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const cleanLong = (v, max) => String(v ?? "").replace(/\r/g, "").trim().slice(0, max);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------------- photos ---------------- */

async function gallery() {
  const items = (await store().get("index", { type: "json" })) || [];
  return json({ items }, 200, { "cache-control": "public, max-age=0, must-revalidate" });
}

async function image(id) {
  if (!ID.test(id)) return new Response("Not found", { status: 404 });
  const found = await store().getWithMetadata(`img-${id}`, { type: "stream" });
  if (!found) return new Response("Not found", { status: 404 });
  return new Response(found.data, {
    headers: {
      "content-type": found.metadata?.contentType || "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

async function upload(req) {
  let form;
  try { form = await req.formData(); } catch { return json({ error: "Could not read upload" }, 400); }
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "No file received" }, 400);
  if (!TYPES.includes(file.type)) return json({ error: "Use a JPG, PNG or WebP image" }, 415);
  if (file.size > MAX_BYTES) return json({ error: "Image is too large (max 4.5 MB)" }, 413);

  const id = crypto.randomUUID();
  const s = store();
  await s.set(`img-${id}`, await file.arrayBuffer(), { metadata: { contentType: file.type } });
  const category = String(form.get("category") || "");
  const item = {
    id,
    title: clean(form.get("title"), 80),
    caption: clean(form.get("caption"), 240),
    category: CATEGORIES.includes(category) ? category : "other",
    createdAt: new Date().toISOString(),
  };
  const index = (await s.get("index", { type: "json" })) || [];
  index.unshift(item);
  await s.setJSON("index", index);
  return json({ ok: true, item }, 201);
}

async function remove(req) {
  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const id = String(body?.id || "");
  if (!ID.test(id)) return json({ error: "Bad id" }, 400);
  const s = store();
  const index = (await s.get("index", { type: "json" })) || [];
  await s.setJSON("index", index.filter((item) => item.id !== id));
  await s.delete(`img-${id}`);
  return json({ ok: true });
}

/* ---------------- bookings ---------------- */

const REF_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function newRef(existing) {
  const d = new Date();
  const stamp = String(d.getUTCFullYear()).slice(2) + String(d.getUTCMonth() + 1).padStart(2, "0") + String(d.getUTCDate()).padStart(2, "0");
  for (let tries = 0; tries < 20; tries++) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const ref = `T8-${stamp}-${[...bytes].map((b) => REF_CHARS[b % REF_CHARS.length]).join("")}`;
    if (!existing.some((b) => b.id === ref)) return ref;
  }
  return `T8-${stamp}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL);

async function sendEmail({ subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY, to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return { sent: false, error: "Email is not set up yet (RESEND_API_KEY and NOTIFY_EMAIL are missing in Netlify)." };
  const body = { from: process.env.FROM_EMAIL || "Turn8digital <onboarding@resend.dev>", to: [to], subject, html, text };
  if (replyTo) body.reply_to = replyTo;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { sent: false, error: `Email service replied ${r.status}: ${t.slice(0, 220)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e?.name === "AbortError" ? "Email service took too long to answer." : "Could not reach the email service." };
  } finally {
    clearTimeout(timer);
  }
}

function bookingEmail(b, origin) {
  const rows = [
    ["Reference", b.id], ["Service", b.serviceLabel], ["Name", b.name], ["Phone / WhatsApp", b.phone || "—"],
    ["Email", b.email || "—"], ["Prefers", b.method || "—"],
  ];
  const answers = b.answers.map((a) => [a.label, a.value]);
  const tr = (k, v) => `<tr><td style="padding:6px 14px 6px 0;color:#5b6b67;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;color:#16211f;white-space:pre-wrap">${esc(v)}</td></tr>`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px"><h2 style="margin:0 0 4px;color:#0B2E2B">New booking request</h2>
<p style="margin:0 0 16px;color:#5b6b67">${esc(b.serviceLabel)} · ${esc(b.id)}</p>
<table style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => tr(k, v)).join("")}<tr><td colspan="2" style="padding:12px 0 4px;color:#C9A15A;font-weight:bold">Details</td></tr>${answers.map(([k, v]) => tr(k, v)).join("")}</table>
<p style="margin-top:20px"><a href="${esc(origin)}/admin.html" style="background:#C9A15A;color:#0B2E2B;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Open in admin</a></p></div>`;
  const text = [`New booking request: ${b.serviceLabel} (${b.id})`, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", "Details:", ...answers.map(([k, v]) => `${k}: ${v}`), "", `Admin: ${origin}/admin.html`].join("\n");
  return { subject: `New booking request · ${b.serviceLabel} · ${b.name} (${b.id})`, html, text, replyTo: /^\S+@\S+\.\S+$/.test(b.email) ? b.email : undefined };
}

async function book(req, context) {
  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  // bots: a hidden field real visitors never fill in
  if (clean(body.hp, 50)) return json({ ok: true, id: "T8-OK" }, 201);
  // people don't fill this in under 3 seconds
  if (!(Number(body.elapsed) >= 3000)) return json({ error: "Please take a moment to check your details, then send again." }, 400);

  const service = String(body.service || "");
  if (!SERVICES[service]) return json({ error: "Please choose a service." }, 400);
  const name = clean(body.name, 100), phone = clean(body.phone, 30), email = clean(body.email, 150);
  if (name.length < 2) return json({ error: "Please enter your name." }, 400);
  const digits = phone.replace(/\D/g, "");
  if (!phone && !email) return json({ error: "Please give a phone number or an email so we can reply." }, 400);
  if (phone && (digits.length < 9 || digits.length > 15)) return json({ error: "That phone number doesn't look right." }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "That email address doesn't look right." }, 400);
  const method = ["WhatsApp", "Phone call", "Email"].includes(body.method) ? body.method : "";

  const rawAnswers = Array.isArray(body.answers) ? body.answers.slice(0, 40) : [];
  const answers = rawAnswers
    .map((a) => ({ label: clean(a?.label, 120), value: cleanLong(Array.isArray(a?.value) ? a.value.join(", ") : a?.value, 1500) }))
    .filter((a) => a.label && a.value);

  const s = store();

  // simple rate limit: 5 requests per hour per visitor
  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const key = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  const now = Date.now();
  const limits = (await s.get("ratelimit", { type: "json" })) || {};
  for (const k of Object.keys(limits)) { limits[k] = limits[k].filter((t) => now - t < 3600e3); if (!limits[k].length) delete limits[k]; }
  const mine = limits[key] || [];
  if (mine.length >= 5) return json({ error: "You've sent several requests already. Please try again later, or message us on WhatsApp." }, 429);
  limits[key] = [...mine, now];
  await s.setJSON("ratelimit", limits);

  const list = (await s.get("bookings", { type: "json" })) || [];
  const record = {
    id: newRef(list),
    createdAt: new Date().toISOString(),
    service,
    serviceLabel: SERVICES[service],
    status: "new",
    name, phone, email, method,
    answers,
    note: "",
    notified: null,
  };
  list.unshift(record);
  await s.setJSON("bookings", list);

  // email alert (the booking is already saved, so a failed email never loses it)
  const origin = new URL(req.url).origin;
  const result = await sendEmail(bookingEmail(record, origin));
  const fresh = (await s.get("bookings", { type: "json" })) || [];
  const idx = fresh.findIndex((b) => b.id === record.id);
  if (idx >= 0) { fresh[idx].notified = result; await s.setJSON("bookings", fresh); }

  return json({ ok: true, id: record.id, serviceLabel: record.serviceLabel }, 201);
}

async function listBookings() {
  const list = (await store().get("bookings", { type: "json" })) || [];
  return json({ bookings: list, emailConfigured: emailConfigured() });
}

async function updateBooking(req) {
  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const s = store();
  const list = (await s.get("bookings", { type: "json" })) || [];
  const b = list.find((x) => x.id === String(body?.id || ""));
  if (!b) return json({ error: "Booking not found" }, 404);
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return json({ error: "Bad status" }, 400);
    b.status = body.status;
  }
  if (body.note !== undefined) b.note = cleanLong(body.note, 2000);
  await s.setJSON("bookings", list);
  return json({ ok: true, booking: b });
}

async function deleteBooking(req) {
  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const s = store();
  const list = (await s.get("bookings", { type: "json" })) || [];
  const next = list.filter((x) => x.id !== String(body?.id || ""));
  if (next.length === list.length) return json({ error: "Booking not found" }, 404);
  await s.setJSON("bookings", next);
  return json({ ok: true });
}

async function testEmail(req) {
  const origin = new URL(req.url).origin;
  const result = await sendEmail({
    subject: "Test email from your Turn8digital admin",
    text: `If you can read this, booking alerts are working.\n${origin}/admin.html`,
    html: `<p>If you can read this, booking alerts are working.</p><p><a href="${esc(origin)}/admin.html">Open admin</a></p>`,
  });
  return json(result, result.sent ? 200 : 502);
}

/* ---------------- router ---------------- */

export default async (req, context) => {
  const { pathname } = new URL(req.url);
  const route = pathname.replace(/\/+$/, "");

  if (req.method === "GET" && route === "/api/gallery") return gallery();
  if (req.method === "GET" && route.startsWith("/api/image/")) return image(route.slice("/api/image/".length));
  if (req.method === "POST" && route === "/api/book") return book(req, context);

  const adminPost = ["/api/auth-check", "/api/upload", "/api/delete", "/api/booking-update", "/api/booking-delete", "/api/test-email"];
  const isAdminRoute = (req.method === "POST" && adminPost.includes(route)) || (req.method === "GET" && route === "/api/bookings");
  if (isAdminRoute) {
    if (!process.env.ADMIN_PASSWORD) return json({ error: "ADMIN_PASSWORD is not set in Netlify yet" }, 500);
    if (!isAuthorized(req)) return json({ error: route === "/api/auth-check" ? "Wrong password" : "Unauthorized" }, 401);
    switch (route) {
      case "/api/auth-check": return json({ ok: true });
      case "/api/upload": return upload(req);
      case "/api/delete": return remove(req);
      case "/api/bookings": return listBookings();
      case "/api/booking-update": return updateBooking(req);
      case "/api/booking-delete": return deleteBooking(req);
      case "/api/test-email": return testEmail(req);
    }
  }
  return json({ error: "Not found" }, 404);
};

export const config = { path: "/api/*" };
