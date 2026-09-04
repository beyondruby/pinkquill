import type { Metadata } from "next";
import NotificationPreferences from "@/components/settings/NotificationPreferences";

export const metadata: Metadata = {
  title: "Notifications — Settings",
};

export default function NotificationsSettingsPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="font-display text-2xl text-ink mb-2">Notifications</h2>
        <p className="font-body text-muted">
          Choose what reaches you, and where. In-app controls your notification panel and badge;
          email sends the same updates to your inbox. Nothing here affects anyone else.
        </p>
      </div>

      <NotificationPreferences />
    </div>
  );
}
