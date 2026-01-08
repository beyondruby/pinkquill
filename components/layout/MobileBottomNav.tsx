"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

const navItems = [
  { icon: "home", label: "Home", href: "/" },
  { icon: "compass", label: "Explore", href: "/explore" },
  { icon: "create", label: "Create", href: "/create" },
  { icon: "users", label: "Communities", href: "/community" },
  { icon: "profile", label: "Profile", href: "/profile" },
];

const icons: Record<string, React.ReactElement> = {
  home: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  compass: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  create: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
    </svg>
  ),
  users: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  profile: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
};

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user, profile } = useAuth();

  // Get the profile href - use user's studio if logged in
  const getProfileHref = () => {
    if (user && profile?.username) {
      return `/studio/${profile.username}`;
    }
    return "/login";
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-black/[0.06] md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const href = item.icon === "profile" ? getProfileHref() : item.href;
          const isActive = item.icon === "profile"
            ? pathname.startsWith("/studio/") || pathname === "/login"
            : pathname === item.href;
          const isCreate = item.icon === "create";

          return (
            <Link
              key={item.href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isCreate
                  ? ""
                  : isActive
                  ? "text-pink-vivid"
                  : "text-muted hover:text-purple-primary"
              }`}
            >
              {isCreate ? (
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid flex items-center justify-center text-white shadow-lg shadow-pink-vivid/30">
                  {icons[item.icon]}
                </div>
              ) : (
                <>
                  {item.icon === "profile" && user && profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className={`w-6 h-6 rounded-full object-cover ${
                        isActive ? "ring-2 ring-pink-vivid" : ""
                      }`}
                    />
                  ) : (
                    icons[item.icon]
                  )}
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
