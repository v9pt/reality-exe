"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { profile } from "@/config/portfolio";
import { validate, type ContactErrors } from "@/lib/contact";
import { SECTIONS } from "@/lib/sections";
import { useGame } from "@/store/game";
import { Label, Sheet } from "../ui/Sheet";

type Status =
  | { s: "idle" }
  | { s: "sending" }
  | { s: "sent"; id: string }
  | { s: "offline"; message: string }
  | { s: "error"; message: string };

export function ContactPanel() {
  const [form, setForm] = useState({ name: "", email: "", message: "", hp_ref: "" });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<Status>({ s: "idle" });
  const [copied, setCopied] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k as keyof ContactErrors]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const mailto = `mailto:${profile.contact.email}?subject=${encodeURIComponent(`Hello from ${form.name || "your portfolio"}`)}&body=${encodeURIComponent(form.message)}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate(form);
    setErrors(v.errors);
    if (Object.keys(v.errors).length) {
      const first = Object.keys(v.errors)[0];
      document.getElementById(`c-${first}`)?.focus();
      return;
    }
    setStatus({ s: "sending" });
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStatus({ s: "sent", id: String(data.id).slice(0, 8) });
        useGame.getState().toast({ tone: "info", title: "Message sent", body: "A reply will come to the address you gave." });
      } else if (data.code === "invalid") {
        setErrors(data.errors ?? {});
        setStatus({ s: "idle" });
      } else if (data.code === "relay_offline") {
        setStatus({ s: "offline", message: data.message });
      } else {
        setStatus({ s: "error", message: data.message ?? "The message didn't go through." });
      }
    } catch {
      setStatus({ s: "error", message: "No connection. Check your network and try again, or use email." });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.contact.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the address is visible anyway */
    }
  };

  const channels = [
    { k: "GitHub", v: profile.contact.github.replace("https://", ""), href: profile.contact.github },
    profile.contact.linkedin ? { k: "LinkedIn", v: profile.contact.linkedin.replace("https://www.", ""), href: profile.contact.linkedin } : null,
    profile.contact.leetcode ? { k: "LeetCode", v: profile.contact.leetcode.replace("https://", "").replace(/\/$/, ""), href: profile.contact.leetcode } : null,
  ].filter(Boolean) as { k: string; v: string; href: string }[];

  return (
    <Sheet glyph={SECTIONS[5].glyph} title="Comms" subtitle="Open to software engineering roles and interesting projects.">
      <div className="bg-ink p-4 text-paper">
        <p className="text-[12px] text-paper/60">Direct line</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href={`mailto:${profile.contact.email}`} className="display text-[clamp(1.6rem,4.5vw,2.2rem)] hover:text-crimson">
            {profile.contact.email}
          </a>
          <button onClick={copy} className="border border-paper/30 px-2 py-0.5 text-[12px] hover:border-paper">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <ul className="mt-3 grid gap-px bg-ink/20 sm:grid-cols-3">
        {channels.map((c) => (
          <li key={c.k}>
            <a href={c.href} target="_blank" rel="noreferrer" className="block bg-paper px-3 py-3 hover:bg-paper-2">
              <span className="block text-[15px] font-bold">{c.k}</span>
              <span className="block truncate text-[13px] text-ink-2">{c.v}</span>
            </a>
          </li>
        ))}
      </ul>
      {profile.contact.resume ? (
        <a href={profile.contact.resume} download className="mt-3 inline-block bg-crimson-ink px-4 py-2 text-[14px] font-bold text-paper hover:bg-ink">
          Download resume (PDF)
        </a>
      ) : null}

      <Label className="mt-8">Send a message</Label>
      <AnimatePresence mode="wait">
        {status.s === "sent" ? (
          <Established key="ok" id={status.id} onAgain={() => { setForm({ name: "", email: "", message: "", hp_ref: "" }); setStatus({ s: "idle" }); }} />
        ) : (
          <motion.form key="form" exit={{ opacity: 0 }} onSubmit={submit} noValidate className="mt-2 grid gap-3">
            <Field id="c-name" label="Name" error={errors.name}>
              <input id="c-name" value={form.name} onChange={set("name")} autoComplete="name" className={inputCls(!!errors.name)} aria-invalid={!!errors.name} aria-describedby={errors.name ? "c-name-err" : undefined} />
            </Field>
            <Field id="c-email" label="Email" error={errors.email}>
              <input id="c-email" type="email" value={form.email} onChange={set("email")} autoComplete="email" className={inputCls(!!errors.email)} aria-invalid={!!errors.email} aria-describedby={errors.email ? "c-email-err" : undefined} />
            </Field>
            <Field id="c-message" label="Message" error={errors.message}>
              <textarea id="c-message" rows={5} value={form.message} onChange={set("message")} className={`${inputCls(!!errors.message)} resize-y`} aria-invalid={!!errors.message} aria-describedby={errors.message ? "c-message-err" : undefined} />
            </Field>
            {/* Honeypot, hidden from people and assistive tech. */}
            <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" value={form.hp_ref} onChange={set("hp_ref")} name="hp_ref" />

            {status.s === "offline" || status.s === "error" ? (
              <div role="alert" className="border-l-4 border-crimson-ink bg-paper-2 p-3 text-[14px]">
                <p className="font-bold">{status.s === "offline" ? "Relay offline" : "Not sent"}</p>
                <p className="text-ink-2">{status.message} Your message is still here.</p>
                <a href={mailto} className="mt-2 inline-block font-bold text-crimson-ink underline">
                  Open it in your email app instead
                </a>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button type="submit" disabled={status.s === "sending"} className="bg-ink px-5 py-2.5 text-[15px] font-bold text-paper hover:bg-crimson-ink disabled:opacity-60">
                {status.s === "sending" ? "Sending…" : "Send message"}
              </button>
              {status.s === "sending" ? <span className="text-[13px] text-ink-3" aria-live="polite">Establishing link</span> : null}
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

const inputCls = (bad: boolean) =>
  `w-full border-b-2 bg-paper-2/60 px-3 py-2 text-[15px] text-ink outline-none focus:bg-paper-2 ${bad ? "border-crimson-ink" : "border-ink/40 focus:border-ink"}`;

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-bold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-[13px] text-crimson-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Shown only after the server confirms the send. */
function Established({ id, onAgain }: { id: string; onAgain: () => void }) {
  const rm = useGame((s) => s.reducedMotion);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 bg-ink p-5 text-paper" role="status">
      <svg viewBox="0 0 300 90" className="w-full" aria-hidden>
        <circle cx="30" cy="45" r="6" fill="#3ee8e0" />
        <circle cx="270" cy="45" r="6" fill="#ff3b4f" />
        <motion.line x1="36" y1="45" x2="264" y2="45" stroke="#e9e4d6" strokeWidth="1.5" strokeDasharray="4 4" initial={{ pathLength: rm ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} />
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx="270"
            cy="45"
            fill="none"
            stroke="#ff3b4f"
            initial={{ r: 6, opacity: 0.8 }}
            animate={rm ? { r: 14 + i * 10, opacity: 0.3 } : { r: 40, opacity: 0 }}
            transition={rm ? { duration: 0 } : { delay: 0.8 + i * 0.25, duration: 1.4, repeat: 2 }}
          />
        ))}
        {!rm ? (
          <motion.rect y="42" width="10" height="6" fill="#3ee8e0" initial={{ x: 36 }} animate={{ x: 254 }} transition={{ duration: 0.8, ease: "easeIn" }} />
        ) : null}
        <text x="30" y="75" textAnchor="middle" fill="#a39e90" fontSize="10">You</text>
        <text x="270" y="75" textAnchor="middle" fill="#a39e90" fontSize="10">{profile.name.split(" ")[0]}</text>
      </svg>
      <p className="kanji mt-2 text-[13px] text-cyan">接続確立</p>
      <p className="display text-[2.2rem]">Connection established</p>
      <p className="mt-1 text-[14px] text-paper/75">Message delivered. Reference {id}. Expect a reply at the address you gave.</p>
      <button onClick={onAgain} className="mt-4 border border-paper/30 px-3 py-1.5 text-[13px] hover:border-paper">
        Send another
      </button>
    </motion.div>
  );
}
