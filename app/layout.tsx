import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const score = Big_Shoulders({ subsets: ["latin"], variable: "--font-score", weight: ["600", "800", "900"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "NutriFit", template: "%s · NutriFit" },
  description: "Tu diario de comida y entreno, con un profe que te banca.",
  applicationName: "NutriFit",
  appleWebApp: { capable: true, title: "NutriFit", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d0c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={`${manrope.variable} ${score.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: { background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--text)" },
          }}
        />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
