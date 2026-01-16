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
import { ModalProvider } from "@/components/providers/ModalProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { AuthModalProvider } from "@/components/providers/AuthModalProvider";
import { LightboxProvider } from "@/components/ui/Lightbox";
import AuthModal from "@/components/auth/AuthModal";

const libreBaskerville = Libre_Baskerville({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-libre-baskerville",
});

const crimsonPro = Crimson_Pro({
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-crimson-pro",
});

const josefinSans = Josefin_Sans({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-josefin-sans",
});

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

const openSans = Open_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-open-sans",
});

const playfairDisplay = Playfair_Display({
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-playfair-display",
});

const lora = Lora({
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-lora",
});

const merriweather = Merriweather({
  weight: ["300", "400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-merriweather",
});

const dancingScript = Dancing_Script({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-dancing-script",
});

const caveat = Caveat({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-caveat",
});

const sourceCodePro = Source_Code_Pro({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-source-code-pro",
});

const inter = Inter({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-inter",
});

const spectral = Spectral({
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-spectral",
});

const ebGaramond = EB_Garamond({
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-eb-garamond",
});

const cormorantGaramond = Cormorant_Garamond({
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-cormorant-garamond",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${libreBaskerville.variable} ${crimsonPro.variable} ${josefinSans.variable} ${poppins.variable} ${openSans.variable} ${playfairDisplay.variable} ${lora.variable} ${merriweather.variable} ${dancingScript.variable} ${caveat.variable} ${sourceCodePro.variable} ${inter.variable} ${spectral.variable} ${ebGaramond.variable} ${cormorantGaramond.variable} antialiased`}
      >
        {/* Aura Gradient Background */}
        <div className="aura-blob blob-1" />
        <div className="aura-blob blob-2" />
        <div className="aura-blob blob-3" />

        <AuthProvider>
          <AuthModalProvider>
            <LightboxProvider>
              <ModalProvider>{children}</ModalProvider>
            </LightboxProvider>
            <AuthModal />
          </AuthModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}