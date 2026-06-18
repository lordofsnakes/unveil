import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { InstallBanner } from "@/components/InstallBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Veil — lift the veil",
  description: "Pay-per-tap premium content on Tempo. Tap to reveal.",
  applicationName: "Veil",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Veil",
  },
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // prevent zoom on iOS form inputs
  userScalable: false,
  viewportFit: "cover", // handles iPhone notch
  themeColor: "#121012",
};

// Applies the persisted theme before paint (dark default → no class). No FOUC.
const themeScript = `(function(){try{if(localStorage.getItem('veil-theme')==='light'){document.documentElement.classList.add('light')}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-bg text-text flex min-h-full flex-col">
        <Providers>
          {children}
          <InstallBanner />
        </Providers>
      </body>
    </html>
  );
}
