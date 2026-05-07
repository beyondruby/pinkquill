import type { Metadata } from "next";
import {
  Libre_Baskerville,
  Crimson_Pro,
  Josefin_Sans,
  Poppins,
  Open_Sans,
  Playfair_Display,
  Lora,
  Merriweather,
  Dancing_Script,
  Caveat,
  Source_Code_Pro,
  Inter,
  Spectral,
  EB_Garamond,
  Cormorant_Garamond,
} from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ModalProvider } from "@/components/providers/ModalProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { AuthModalProvider } from "@/components/providers/AuthModalProvider";
import { BadgeCountProvider } from "@/components/providers/BadgeCountProvider";
import { UserEventsProvider } from "@/components/providers/UserEventsProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { LightboxProvider } from "@/components/ui/Lightbox";
import AuthModal from "@/components/auth/AuthModal";
import { getServerTheme, getInlineThemeResolveScript } from "@/lib/theme/server";

function getSupabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Creative fonts - deferred loading (used for post styling)
const libreBaskerville = Libre_Baskerville({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-libre-baskerville",
  display: "swap",
  preload: false, // Deferred - only used for creative posts
});

const crimsonPro = Crimson_Pro({
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-crimson-pro",
  display: "swap",
  preload: false, // Deferred - only used for creative posts
});

const josefinSans = Josefin_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-josefin-sans",
  display: "swap",
  preload: false, // Deferred - only used for creative posts
});

// Core UI fonts - preloaded for fast initial render
const poppins = Poppins({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
  preload: true, // Core UI font - preload
});

const openSans = Open_Sans({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
  preload: true, // Core body font - preload
});

const playfairDisplay = Playfair_Display({
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-playfair-display",
  display: "swap",
  preload: false,
});

const lora = Lora({
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
  preload: false,
});

const merriweather = Merriweather({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-merriweather",
  display: "swap",
  preload: false,
});

const dancingScript = Dancing_Script({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-dancing-script",
  display: "swap",
  preload: false,
});

const caveat = Caveat({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
  preload: false,
});

const sourceCodePro = Source_Code_Pro({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-source-code-pro",
  display: "swap",
  preload: false,
});

const inter = Inter({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

const spectral = Spectral({
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-spectral",
  display: "swap",
  preload: false,
});

const ebGaramond = EB_Garamond({
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-eb-garamond",
  display: "swap",
  preload: false,
});

const cormorantGaramond = Cormorant_Garamond({
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-cormorant-garamond",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://pinkquill.co"),
  title: "PinkQuill - The Creative Platform",
  description: "The social platform built for creatives. Share your art, grow your audience, and connect with a community that gets it.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "PinkQuill - The Creative Platform",
    description: "The social platform built for creatives. Share your art, grow your audience, and connect with a community that gets it.",
    type: "website",
    siteName: "PinkQuill",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PinkQuill - Share your creative journey",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PinkQuill - The Creative Platform",
    description: "The social platform built for creatives. Share your art, grow your audience, and connect with a community that gets it.",
    images: ["/og-image.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseOrigin = getSupabaseOrigin();
  const { storedId, resolvedId, needsClientResolve } = await getServerTheme();

  return (
    <html
      lang="en"
      data-theme={resolvedId}
      data-theme-mode={storedId === "system" ? "system" : "explicit"}
      suppressHydrationWarning
    >
      <head>
        {/*
          Inline theme-resolve script: when the user's stored preference is
          'system', we stamp the light fallback in SSR and then re-stamp to
          the OS-preferred variant here, synchronously, before paint. For
          explicit themes the SSR data-theme is already correct and this
          script is omitted entirely.
        */}
        {needsClientResolve ? (
          <script
            dangerouslySetInnerHTML={{ __html: getInlineThemeResolveScript() }}
          />
        ) : null}
        {/* Preconnect to critical origins for faster resource loading */}
        {supabaseOrigin ? (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        ) : null}
      </head>
      <body
        className={`${libreBaskerville.variable} ${crimsonPro.variable} ${josefinSans.variable} ${poppins.variable} ${openSans.variable} ${playfairDisplay.variable} ${lora.variable} ${merriweather.variable} ${dancingScript.variable} ${caveat.variable} ${sourceCodePro.variable} ${inter.variable} ${spectral.variable} ${ebGaramond.variable} ${cormorantGaramond.variable} antialiased`}
      >
        {/* Aura Gradient Background */}
        <div className="aura-blob blob-1" />
        <div className="aura-blob blob-2" />
        <div className="aura-blob blob-3" />

        <AuthProvider>
          <ThemeProvider initialThemeId={storedId}>
            <UserEventsProvider>
              <BadgeCountProvider>
                <AuthModalProvider>
                  <LightboxProvider>
                    <ModalProvider>{children}</ModalProvider>
                  </LightboxProvider>
                  <AuthModal />
                </AuthModalProvider>
              </BadgeCountProvider>
            </UserEventsProvider>
          </ThemeProvider>
        </AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-toast-bg)',
              color: 'var(--color-toast-text)',
              border: '1px solid var(--color-toast-border)',
            },
            className: 'toast-notification',
          }}
        />
      </body>
    </html>
  );
}
