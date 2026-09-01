"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { NOTIFICATION_CATEGORIES } from "@/lib/utils/notificationCategories";
import { Spinner } from "@/components/ui/Loading";

export default function NotificationPreferences() {
  const { user, profile, refreshProfile } = useAuth();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const preferences = profile?.notification_preferences || {};

  const handleToggle = async (categoryKey: string) => {
    if (!user || savingKey) return;

    const currentlyEnabled = preferences[categoryKey] !== false;
    const next = { ...preferences, [categoryKey]: !currentlyEnabled };

    setSavingKey(categoryKey);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: next })
        .eq("id", user.id);

      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      console.error("[NotificationPreferences] Failed to update:", err);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="space-y-3">
      {NOTIFICATION_CATEGORIES.map((category) => {
        const enabled = preferences[category.key] !== false;
        const saving = savingKey === category.key;

        return (
          <div
            key={category.key}
            className="flex items-center justify-between gap-4 bg-surface rounded-2xl border border-border-light p-5"
          >
            <div className="flex-1">
              <h4 className="font-ui text-[0.95rem] font-medium text-ink">{category.label}</h4>
              <p className="font-body text-sm text-muted mt-0.5">{category.description}</p>
            </div>

            {saving ? (
              <div className="w-12 h-7 flex items-center justify-center">
                <Spinner size="sm" className="text-purple-primary" />
              </div>
            ) : (
              <button
                onClick={() => handleToggle(category.key)}
                aria-pressed={enabled}
                aria-label={`${enabled ? "Disable" : "Enable"} ${category.label} notifications`}
                className={`relative w-12 h-7 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                  enabled ? "bg-gradient-to-r from-purple-primary to-pink-vivid" : "bg-border-strong"
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-surface rounded-full shadow-md transition-all duration-200 ${
                    enabled ? "left-6" : "left-1"
                  }`}
                />
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
