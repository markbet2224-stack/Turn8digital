// Turn8digital photo API: one file, five small jobs.
//   GET  /api/gallery      public  list of uploaded photos (newest first)
//   GET  /api/image/<id>   public  one photo
//   POST /api/auth-check   admin   checks the password
//   POST /api/upload       admin   adds a photo
//   POST /api/delete       admin   removes a photo
// The admin password is the ADMIN_PASSWORD environment variable in Netlify.
import { createHash, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const CATEGORIES = ["website", "event", "other"];
const MAX_BYTES = 4.5 * 1024 * 1024; // Netlify caps request bodies at ~6 MB
const ID = /^[a-f0-9-]{36}$/;

// Photos are saved as "img-<id>"; a small JSON list called "index" describes them.
// Strong consistency means a new photo shows up on the site immediately.
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
      "cache-control": "public, max-age=31536000, immutable", // ids are never reused
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

export default async (req) => {
  const { pathname } = new URL(req.url);
  const route = pathname.replace(/\/+$/, "");

  if (req.method === "GET" && route === "/api/gallery") return gallery();
  if (req.method === "GET" && route.startsWith("/api/image/")) return image(route.slice("/api/image/".length));

  if (req.method === "POST" && ["/api/auth-check", "/api/upload", "/api/delete"].includes(route)) {
    if (!process.env.ADMIN_PASSWORD) return json({ error: "ADMIN_PASSWORD is not set in Netlify yet" }, 500);
    if (!isAuthorized(req)) return json({ error: route === "/api/auth-check" ? "Wrong password" : "Unauthorized" }, 401);
    if (route === "/api/auth-check") return json({ ok: true });
    return route === "/api/upload" ? upload(req) : remove(req);
  }

  return json({ error: "Not found" }, 404);
};

export const config = { path: "/api/*" };
