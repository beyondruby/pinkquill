"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { NOTIFICATION_CATEGORIES } from "@/lib/utils/notificationCategories";
import { Spinner } from "@/components/ui/Loading";

function Toggle({ enabled, saving, label, onToggle }: { enabled: boolean; saving: boolean; label: string; onToggle: () => void }) {
  if (saving) {
    return (
      <div className="w-12 h-7 flex items-center justify-center">
        <Spinner size="sm" className="text-purple-primary" />
      </div>
    );
  }
  return (
    <button
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={`${enabled ? "Disable" : "Enable"} ${label}`}
      className={`relative w-12 h-7 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
        enabled ? "bg-gradient-to-r from-purple-primary to-pink-vivid" : "bg-border-strong"
      }`}
    >
      <div className={`absolute top-1 w-5 h-5 bg-surface rounded-full shadow-md transition-all duration-200 ${enabled ? "left-6" : "left-1"}`} />
    </button>
  );
}

export default function NotificationPreferences() {
  const { user, profile, refreshProfile } = useAuth();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const preferences = profile?.notification_preferences || {};
  const emailPreferences = profile?.email_preferences || {};

  const save = async (key: string, column: "notification_preferences" | "email_preferences", next: Record<string, boolean>) => {
    if (!user || savingKey) return;
    setSavingKey(key);
    try {
      const { error } = await supabase.from("profiles").update({ [column]: next }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      console.error("[NotificationPreferences] Failed to update:", err);
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggle = (categoryKey: string) => {
    const currentlyEnabled = preferences[categoryKey] !== false;
    void save(categoryKey, "notification_preferences", { ...preferences, [categoryKey]: !currentlyEnabled });
  };

  const emailOrders = emailPreferences.orders !== false;

  return (
    <section className="space-y-3">
      {NOTIFICATION_CATEGORIES.map((category) => {
        const enabled = preferences[category.key] !== false;
        return (
          <div
            key={category.key}
            className="flex items-center justify-between gap-4 bg-surface rounded-2xl border border-border-light p-5"
          >
            <div className="flex-1">
              <h4 className="font-ui text-[0.95rem] font-medium text-ink">{category.label}</h4>
              <p className="font-body text-sm text-muted mt-0.5">{category.description}</p>
            </div>
            <Toggle enabled={enabled} saving={savingKey === category.key} label={`${category.label} notifications`} onToggle={() => handleToggle(category.key)} />
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-4 bg-surface rounded-2xl border border-border-light p-5">
        <div className="flex-1">
          <h4 className="font-ui text-[0.95rem] font-medium text-ink">Email me about orders</h4>
          <p className="font-body text-sm text-muted mt-0.5">Requests, payments, deliveries, due dates and disputes, sent to your account email as they happen</p>
        </div>
        <Toggle enabled={emailOrders} saving={savingKey === "email:orders"} label="order emails" onToggle={() => void save("email:orders", "email_preferences", { ...emailPreferences, orders: !emailOrders })} />
      </div>
    </section>
  );
}
