"use client";

import { NavigationIcon } from "@/components/ui/NavigationIcon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

const icons: Record<string, React.ReactElement> = {
  "home": <NavigationIcon name="home" className="w-6 h-6" />,
  "compass": <NavigationIcon name="compassMobile" className="w-6 h-6" />,
  "create": <NavigationIcon name="create" className="w-6 h-6" />,
  "takes": <NavigationIcon name="takesMobile" className="w-6 h-6" />,
  "users": <NavigationIcon name="users" className="w-6 h-6" />,
  "profile": <NavigationIcon name="profile" className="w-6 h-6" />,
};

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user, profile } = useAuth();


  // Hide bottom nav on messages page (it has its own full-screen layout)
  const isMessagesPage = pathname.startsWith("/messages");
  if (isMessagesPage) return null;

  // Build nav items dynamically based on auth state
  const navItems = [
    { icon: "home", label: "Home", href: "/" },
    { icon: "compass", label: "Explore", href: "/explore" },
    // Only show Create if user is signed in
    ...(user ? [{ icon: "create", label: "Create", href: "/create" }] : []),
    { icon: "takes", label: "Takes", href: "/takes" },
    { icon: "profile", label: "Profile", href: "/profile" },
  ];

  // Get the profile href - use user's studio if logged in, settings as fallback
  const getProfileHref = () => {
    if (user) {
      return profile?.username ? `/studio/${profile.username}` : "/settings/profile";
    }
    return "/login";
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-xl border-t border-border-light md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const href = item.icon === "profile" ? getProfileHref() : item.href;
          const isActive = item.icon === "profile"
            ? pathname.startsWith("/studio/") || pathname === "/login"
            : pathname === item.href || (item.icon === "takes" && pathname.startsWith("/takes"));
          const isCreate = item.icon === "create";

          return (
            <Link
              key={item.icon}
              href={href}
              aria-label={item.label}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${
                isCreate
                  ? ""
                  : isActive
                  ? "text-accent-2"
                  : "text-muted hover:text-accent"
              }`}
            >
              {isCreate ? (
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid flex items-center justify-center text-on-accent shadow-lg shadow-pink-vivid/30">
                  {icons[item.icon]}
                </div>
              ) : item.icon === "profile" && user ? (
                <div className="relative">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className={`w-9 h-9 rounded-full object-cover ${
                        isActive
                          ? "ring-2 ring-accent-2 ring-offset-2 ring-offset-surface"
                          : "ring-1 ring-border-light"
                      }`}
                    />
                  ) : (
                    <div
                      className={`w-9 h-9 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white text-sm font-semibold ${
                        isActive
                          ? "ring-2 ring-accent-2 ring-offset-2 ring-offset-surface"
                          : ""
                      }`}
                    >
                      {(profile?.display_name || profile?.username || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative">{icons[item.icon]}</div>
                  <span className="text-[10px] font-ui mt-1">{item.label}</span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
