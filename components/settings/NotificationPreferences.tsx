"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { EMAIL_CATEGORIES, emailCategoryEnabled, emailMasterEnabled } from "@/lib/email/preferences";
import { Spinner } from "@/components/ui/Loading";
import { showToast } from "@/lib/utils/toast";

type Prefs = Record<string, boolean>;

function Toggle({ enabled, saving, disabled, label, onToggle }: { enabled: boolean; saving: boolean; disabled?: boolean; label: string; onToggle: () => void }) {
  if (saving) {
    return (
      <div className="w-12 h-7 flex items-center justify-center">
        <Spinner size="sm" className="text-purple-primary" />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={enabled}
      aria-label={`${enabled ? "Disable" : "Enable"} ${label}`}
      className={`relative w-12 h-7 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
      } ${enabled ? "bg-gradient-to-r from-purple-primary to-pink-vivid" : "bg-border-strong"}`}
    >
      <div className={`absolute top-1 w-5 h-5 bg-surface rounded-full shadow-md transition-all duration-200 ${enabled ? "left-6" : "left-1"}`} />
    </button>
  );
}

export default function NotificationPreferences() {
  const { user, profile, refreshProfile } = useAuth();
  const [inApp, setInApp] = useState<Prefs>({});
  const [email, setEmail] = useState<Prefs>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    setInApp((profile?.notification_preferences as Prefs | null) ?? {});
    setEmail((profile?.email_preferences as Prefs | null) ?? {});
  }, [profile?.notification_preferences, profile?.email_preferences]);

  const save = async (column: "notification_preferences" | "email_preferences", next: Prefs, savingId: string) => {
    if (!user || savingKey) return;
    const setter = column === "notification_preferences" ? setInApp : setEmail;
    const previous = column === "notification_preferences" ? inApp : email;
    setSavingKey(savingId);
    setter(next);
    try {
      const { error } = await supabase.from("profiles").update({ [column]: next }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      console.error("[NotificationPreferences] Failed to update:", err);
      setter(previous);
      showToast.error("Couldn't save that change", "Please try again in a moment.");
    } finally {
      setSavingKey(null);
    }
  };

  const masterOn = emailMasterEnabled(email);
  const toggleMaster = () => void save("email_preferences", { ...email, all: !masterOn }, "email:all");
  const toggleEmail = (key: string) => void save("email_preferences", { ...email, [key]: !emailCategoryEnabled(email, key) }, `email:${key}`);
  const toggleInApp = (key: string) => void save("notification_preferences", { ...inApp, [key]: inApp[key] === false }, `app:${key}`);

  return (
    <div className="space-y-8">
      <section className="bg-surface rounded-2xl border border-border-light p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-ui text-[0.95rem] font-medium text-ink">Email notifications</h3>
          <p className="font-body text-sm text-muted mt-0.5 break-words">
            {user?.email ? `Sent to ${user.email}.` : "Sent to your account email."} Turn this off to stop everything except sign-in codes and receipts.
          </p>
        </div>
        <Toggle enabled={masterOn} saving={savingKey === "email:all"} label="all email notifications" onToggle={toggleMaster} />
      </section>

      <section>
        <div className="flex items-end justify-between gap-4 px-1 mb-3">
          <div>
            <h3 className="font-ui text-[0.95rem] font-medium text-ink">What you hear about</h3>
            <p className="font-body text-sm text-muted mt-0.5">Choose where each kind of update reaches you.</p>
          </div>
          <div className="hidden sm:flex gap-6 shrink-0 pr-1">
            <span className="w-12 text-center font-ui text-xs text-muted">In-app</span>
            <span className="w-12 text-center font-ui text-xs text-muted">Email</span>
          </div>
        </div>

        <ul className="bg-surface rounded-2xl border border-border-light divide-y divide-border-light">
          {EMAIL_CATEGORIES.map((category) => {
            const inAppOn = inApp[category.key] !== false;
            const emailOn = emailCategoryEnabled(email, category.key);
            const emailBlocked = !masterOn || (category.hasInApp && !inAppOn);
            return (
              <li key={category.key} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-ui text-[0.95rem] font-medium text-ink">{category.label}</h4>
                  <p className="font-body text-sm text-muted mt-0.5">{category.description}</p>
                  {category.key === "orders" && (
                    <p className="font-body text-xs text-muted mt-1.5">On for everyone by default, so buyers and sellers never miss a payment, delivery or refund.</p>
                  )}
                  {category.hasInApp && !inAppOn && (
                    <p className="font-body text-xs text-muted mt-1.5">Hidden in-app, so it isn&apos;t emailed either.</p>
                  )}
                </div>
                <div className="flex gap-6 shrink-0 sm:pr-1">
                  <div className="flex flex-col items-center gap-1 w-12">
                    {category.hasInApp ? (
                      <Toggle enabled={inAppOn} saving={savingKey === `app:${category.key}`} label={`${category.label} in-app notifications`} onToggle={() => toggleInApp(category.key)} />
                    ) : (
                      <span className="h-7 flex items-center font-ui text-xs text-muted">Always</span>
                    )}
                    <span className="sm:hidden font-ui text-[0.7rem] text-muted">In-app</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 w-12">
                    <Toggle enabled={emailOn && !emailBlocked} disabled={emailBlocked} saving={savingKey === `email:${category.key}`} label={`${category.label} emails`} onToggle={() => toggleEmail(category.key)} />
                    <span className="sm:hidden font-ui text-[0.7rem] text-muted">Email</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="font-body text-xs text-muted mt-3 px-1">
          Every email has an unsubscribe link for its kind. Sign-in codes, password resets and receipts are always sent.
        </p>
      </section>
    </div>
  );
}
