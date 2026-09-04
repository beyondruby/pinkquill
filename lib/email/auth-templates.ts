/**
 * Supabase Auth email templates, rendered through the shared layout so the
 * sign-up, magic-link, password-reset, email-change and reauthentication
 * mails look like every other PinkQuill email.
 *
 * `{{ .Token }}`, `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`
 * are Supabase's Go-template placeholders and are passed through untouched.
 * `scripts/build-auth-emails.ts` writes these to `email-templates/*.html`;
 * the files are pasted into Dashboard → Authentication → Emails → Templates.
 */
import { renderEmail, type RenderedEmail } from "./layout";

const SITE = "https://www.pinkquill.com";
const HELP = `${SITE}/help`;

export interface AuthTemplate {
  /** Supabase template key (dashboard section). */
  key: "confirmation" | "magic_link" | "recovery" | "email_change" | "reauthentication" | "invite";
  file: string;
  subject: string;
  rendered: RenderedEmail;
}

export function buildAuthTemplates(): AuthTemplate[] {
  const list: AuthTemplate[] = [];

  list.push({
    key: "confirmation",
    file: "confirm-signup-supabase.html",
    subject: "Your PinkQuill verification code",
    rendered: renderEmail({
      subject: "Your PinkQuill verification code",
      preheader: "Enter this code to finish creating your account.",
      headingHtml: "Welcome to PinkQuill",
      headingText: "Welcome to PinkQuill",
      paragraphs: ["Enter this code on the sign-up page to confirm your email address and open your studio."],
      code: { value: "{{ .Token }}", caption: "This code expires in 60 minutes." },
      reason: "You're getting this because someone signed up for PinkQuill with this address. If it wasn't you, you can ignore this email.",
      secondaryLink: { label: "Need help? Visit the help centre", url: HELP },
    }),
  });

  list.push({
    key: "magic_link",
    file: "magic-link-supabase.html",
    subject: "Your PinkQuill sign-in link",
    rendered: renderEmail({
      subject: "Your PinkQuill sign-in link",
      preheader: "One tap and you're in.",
      headingHtml: "Sign in to PinkQuill",
      headingText: "Sign in to PinkQuill",
      paragraphs: ["Use the button below to sign in. The link works once and expires in 60 minutes."],
      button: { label: "Sign in", url: "{{ .ConfirmationURL }}" },
      reason: "You're getting this because someone asked to sign in to PinkQuill with this address. If it wasn't you, you can ignore this email.",
      secondaryLink: { label: "Need help? Visit the help centre", url: HELP },
    }),
  });

  list.push({
    key: "recovery",
    file: "reset-password-supabase.html",
    subject: "Reset your PinkQuill password",
    rendered: renderEmail({
      subject: "Reset your PinkQuill password",
      preheader: "Choose a new password for your account.",
      headingHtml: "Reset your password",
      headingText: "Reset your password",
      paragraphs: ["Use the button below to choose a new password. The link works once and expires in 60 minutes."],
      button: { label: "Choose a new password", url: "{{ .ConfirmationURL }}" },
      reason: "You're getting this because someone asked to reset the PinkQuill password for this address. If it wasn't you, your password is unchanged and you can ignore this email.",
      secondaryLink: { label: "Need help? Visit the help centre", url: HELP },
    }),
  });

  list.push({
    key: "email_change",
    file: "change-email-supabase.html",
    subject: "Confirm your new PinkQuill email",
    rendered: renderEmail({
      subject: "Confirm your new PinkQuill email",
      preheader: "Confirm the change to your account email.",
      headingHtml: "Confirm your new email address",
      headingText: "Confirm your new email address",
      paragraphs: ["You asked to change the email on your PinkQuill account from {{ .Email }} to {{ .NewEmail }}. Confirm it below to finish."],
      button: { label: "Confirm new email", url: "{{ .ConfirmationURL }}" },
      reason: "You're getting this because an email change was requested on a PinkQuill account. If it wasn't you, secure your account by changing your password.",
      secondaryLink: { label: "Need help? Visit the help centre", url: HELP },
    }),
  });

  list.push({
    key: "reauthentication",
    file: "reauthentication-supabase.html",
    subject: "Your PinkQuill confirmation code",
    rendered: renderEmail({
      subject: "Your PinkQuill confirmation code",
      preheader: "Confirm it's you before a sensitive change.",
      headingHtml: "Confirm it's you",
      headingText: "Confirm it's you",
      paragraphs: ["Enter this code to confirm a sensitive change to your PinkQuill account."],
      code: { value: "{{ .Token }}", caption: "This code expires in a few minutes." },
      reason: "You're getting this because a sensitive change was started on your PinkQuill account. If it wasn't you, change your password.",
      secondaryLink: { label: "Need help? Visit the help centre", url: HELP },
    }),
  });

  list.push({
    key: "invite",
    file: "invite-supabase.html",
    subject: "You've been invited to PinkQuill",
    rendered: renderEmail({
      subject: "You've been invited to PinkQuill",
      preheader: "Accept the invite to create your account.",
      headingHtml: "You're invited to PinkQuill",
      headingText: "You're invited to PinkQuill",
      paragraphs: ["Someone invited you to join PinkQuill, the studio for writers and artists. Accept the invite to create your account."],
      button: { label: "Accept invite", url: "{{ .ConfirmationURL }}" },
      reason: "You're getting this because someone invited this address to PinkQuill. If you weren't expecting it, you can ignore this email.",
      secondaryLink: { label: "Need help? Visit the help centre", url: HELP },
    }),
  });

  return list;
}
