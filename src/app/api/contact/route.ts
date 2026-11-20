import { NextResponse } from "next/server";
import { validate } from "@/lib/contact";

/**
 * Contact relay. Sends through Resend's HTTP API when configured (free tier,
 * no SDK needed). Without configuration it says so with a 503, and the UI
 * offers the visitor's own email app instead. It never pretends to send.
 */

// Best-effort rate limit per server instance: 5 messages per 10 minutes per IP.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "The message couldn't be read. Try again." }, { status: 400 });
  }

  // Honeypot: people never see this field. Answer as if it worked.
  if (body.hp_ref) return NextResponse.json({ ok: true, id: "ok" });

  const { name, email, message, errors } = validate(body);
  if (Object.keys(errors).length) return NextResponse.json({ code: "invalid", errors }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) {
    return NextResponse.json({ code: "rate_limited", message: "Too many messages from this connection. Wait a few minutes, or use email directly." }, { status: 429 });
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!key || !to || !from) {
    return NextResponse.json({ code: "relay_offline", message: "The message relay isn't configured on this deployment." }, { status: 503 });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `Portfolio message from ${name}`,
        text: `From: ${name} <${email}>\n\n${message}`,
      }),
    });
    if (!res.ok) {
      console.error("[contact] relay rejected", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ code: "relay_error", message: "The relay rejected the message. Use email directly for now." }, { status: 502 });
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return NextResponse.json({ ok: true, id: data.id ?? "sent" });
  } catch (e) {
    console.error("[contact] relay unreachable", e);
    return NextResponse.json({ code: "relay_error", message: "The relay couldn't be reached. Use email directly for now." }, { status: 502 });
  }
}
