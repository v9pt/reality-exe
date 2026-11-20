/** Shared by the contact form and the API route, so both give the same messages. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIMITS = { name: 100, email: 320, message: 4000 };

export type ContactErrors = Partial<Record<"name" | "email" | "message", string>>;

export function validate(body: { name?: unknown; email?: unknown; message?: unknown }) {
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  const errors: ContactErrors = {};
  if (!name) errors.name = "Add your name so the reply has someone to address.";
  else if (name.length > LIMITS.name) errors.name = `Keep the name under ${LIMITS.name} characters.`;
  if (!EMAIL.test(email)) errors.email = "Enter an email address a reply can reach, like you@example.com.";
  else if (email.length > LIMITS.email) errors.email = "That email address is too long.";
  if (message.length < 10) errors.message = "Write at least a sentence (10 characters).";
  else if (message.length > LIMITS.message) errors.message = `Keep the message under ${LIMITS.message} characters.`;
  return { name, email, message, errors };
}

