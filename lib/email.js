import { Resend } from "resend";
import { createVerificationToken } from "@/lib/verificationToken";

// Transactional email via Resend (https://resend.com/docs/send-with-nextjs).
// Server-only: RESEND_API_KEY must never reach the browser.

let resend;

function getResend() {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM = process.env.EMAIL_FROM || "The Crafty Studio <onboarding@resend.dev>";

// Base URL used in email links. Prefer APP_URL so links can't be pointed at
// another host through a spoofed Host header.
function appUrl(req) {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${req.headers.host}`;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(bodyHtml) {
  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #2b1916;">
      <h1 style="font-family: Oswald, Arial, sans-serif; font-size: 22px; letter-spacing: 1px; margin: 0 0 24px;">THE CRAFTY STUDIO</h1>
      ${bodyHtml}
    </div>
  `;
}

function button(href, label) {
  return `<a href="${href}" style="display: inline-block; background: #2b1916; color: #ffffff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 700;">${label}</a>`;
}

async function send({ to, subject, html }) {
  const { data, error } = await getResend().emails.send({
    from: FROM,
    to: [to],
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend failed to send "${subject}": ${error.message}`);
  }
  return data;
}

export async function sendVerificationEmail(req, { userId, email, firstName, passwordHash }) {
  const token = createVerificationToken(userId, email, passwordHash);
  const link = `${appUrl(req)}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  return send({
    to: email,
    subject: "Verify your email - The Crafty Studio",
    html: layout(`
      <p>Hi ${escapeHtml(firstName) || "there"},</p>
      <p>Thanks for signing up! Please confirm your email address to activate your account.</p>
      <p style="margin: 28px 0;">${button(link, "Verify Email")}</p>
      <p style="font-size: 13px; color: #6b5a55;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
    `),
  });
}

export async function sendWelcomeEmail(req, { email, firstName }) {
  return send({
    to: email,
    subject: "Welcome to The Crafty Studio!",
    html: layout(`
      <p>Hi ${escapeHtml(firstName) || "there"},</p>
      <p>Your email is verified and your account is ready. Welcome to the community!</p>
      <p>Browse our rooms, classes, and equipment to start making.</p>
      <p style="margin: 28px 0;">${button(`${appUrl(req)}/login`, "Sign In")}</p>
    `),
  });
}
