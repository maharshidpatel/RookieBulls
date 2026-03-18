/*
 * FILE: server/modules/auth/emailService.js
 *
 * RESPONSIBILITY:
 *   Sends transactional emails for the auth module.
 *   Currently handles one email type: email verification.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Token generation (that is service.js)
 *   - Business logic decisions (that is service.js)
 *   - HTTP logic (that is controller.js)
 *
 * HOW IT FITS:
 *   service.js calls sendVerificationEmail() after creating a new user.
 *   This file is the only place in the project that talks to Resend.
 *   If the email provider ever changes, only this file needs to change.
 *
 * EMAIL PROVIDER: Resend
 *   Free tier: 3,000 emails/month, 100/day, no credit card required
 *   Dev from address:  onboarding@resend.dev  (works without a domain)
 *   Prod from address: noreply@rookiebulls.com (after domain setup in Step 11)
 */

const { Resend } = require('resend');
const { env }    = require('../../config/env');

/*
 * Resend client instance.
 * Initialised once with the API key from .env.
 * All email sends go through this single instance.
 */
const resend = new Resend(env.RESEND_API_KEY);

/*
 * FROM ADDRESS
 *
 * onboarding@resend.dev is Resend's shared dev address.
 * It works immediately without any domain verification.
 * Emails sent from it land in inbox (not spam) during development.
 *
 * In production this becomes noreply@rookiebulls.com after
 * the domain is verified with Resend in Step 11.
 */
const FROM_ADDRESS = 'onboarding@resend.dev';

// ─── sendVerificationEmail ────────────────────────────────────────────────
//
// Sends a verification email containing a one-time link.
// Called by service.js immediately after a new user is created.
//
// Parameters:
//   email     — recipient address
//   firstName — used in the greeting line
//   token     — the raw 64-char hex token stored on the user document
//
// The verification link points to the React frontend, not the API.
// The frontend VerifyPage then calls the API with the token.
// Link format: <CLIENT_ORIGIN>/verify/<token>
//
// Why link to the frontend and not the API directly:
//   The API returns JSON — clicking a link in an email needs a page, not JSON.
//   VerifyPage renders a proper UI (loading, success, expired states)
//   and makes the API call programmatically on mount.

async function sendVerificationEmail(email, firstName, token) {
  /*
   * Construct the full verification URL.
   * CLIENT_ORIGIN in dev: http://localhost:5173
   * CLIENT_ORIGIN in prod: https://rookiebulls.com (set in Step 11)
   */
  const verifyUrl = `${env.CLIENT_ORIGIN}/verify/${token}`;

  /*
   * resend.emails.send() accepts a single config object.
   *
   * html: the email body rendered as HTML.
   *   Inline styles are used throughout — many email clients strip
   *   <style> blocks and class-based CSS entirely.
   *   Inline styles are the only reliable way to style HTML email.
   *
   * text: plain-text fallback.
   *   Some email clients (or user preferences) disable HTML.
   *   Always provide a text version — it also improves deliverability.
   */
  const { error } = await resend.emails.send({
    from:    FROM_ADDRESS,
    to:      email,
    subject: 'Verify your RookieBulls account',
    text:    buildPlainText(firstName, verifyUrl),
    html:    buildHtml(firstName, verifyUrl),
  });

  /*
   * Resend returns an error object (not a thrown exception) on failure.
   * We convert it to a thrown error so the caller (service.js) can
   * catch it and handle it consistently with other service errors.
   */
  if (error) {
    const err = new Error(`Failed to send verification email: ${error.message}`);
    err.statusCode = 500;
    throw err;
  }
}

// ─── buildPlainText ───────────────────────────────────────────────────────
//
// Plain-text version of the verification email.
// Used when HTML rendering is disabled on the recipient's email client.

function buildPlainText(firstName, verifyUrl) {
  return [
    `Hi ${firstName},`,
    '',
    'Thanks for registering with RookieBulls.',
    'Please verify your email address by visiting the link below:',
    '',
    verifyUrl,
    '',
    'This link expires in 24 hours.',
    '',
    'If you did not create an account, you can safely ignore this email.',
    '',
    '— The RookieBulls Team',
  ].join('\n');
}

// ─── buildHtml ────────────────────────────────────────────────────────────
//
// HTML version of the verification email.
// All styles are inline — external stylesheets are stripped by most
// email clients (Gmail, Outlook, Apple Mail).

function buildHtml(firstName, verifyUrl) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your RookieBulls account</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="520" cellpadding="0" cellspacing="0"
               style="background-color:#ffffff;border-radius:8px;
                      box-shadow:0 1px 4px rgba(0,0,0,0.08);
                      padding:40px;max-width:520px;width:100%;">
          <tr>
            <td>

              <!-- Logo / Brand -->
              <p style="margin:0 0 4px 0;font-size:22px;font-weight:700;color:#111827;">
                RookieBulls
              </p>
              <p style="margin:0 0 32px 0;font-size:13px;color:#6b7280;">
                Learn to trade. Risk nothing.
              </p>

              <!-- Greeting -->
              <p style="margin:0 0 16px 0;font-size:15px;color:#111827;">
                Hi ${firstName},
              </p>

              <!-- Body -->
              <p style="margin:0 0 24px 0;font-size:15px;color:#374151;line-height:1.6;">
                Thanks for creating a RookieBulls account.
                Click the button below to verify your email address and activate your account.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:#16a34a;border-radius:6px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:12px 28px;
                              font-size:15px;font-weight:600;
                              color:#ffffff;text-decoration:none;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry note -->
              <p style="margin:0 0 24px 0;font-size:13px;color:#6b7280;">
                This link expires in 24 hours.
              </p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px 0;" />

              <!-- Link fallback -->
              <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px 0;font-size:12px;color:#374151;word-break:break-all;">
                ${verifyUrl}
              </p>

              <!-- Ignore note -->
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                If you did not create an account with RookieBulls, you can safely ignore this email.
              </p>

            </td>
          </tr>
        </table>
        <!-- End card -->

      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}

module.exports = { sendVerificationEmail };