import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Inventário TI Casabella",
  description: "Controle de inventario de ativos de TI da Casabella.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Inventário TI Casabella",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/branding/LOGO-CASABELLA-CIRCULO.png",
    apple: "/branding/LOGO-CASABELLA-CIRCULO.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2c6470" },
    { media: "(prefers-color-scheme: dark)", color: "#173a43" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function () {
            try {
              var stored = window.localStorage.getItem('casabella-theme');
              var theme = stored === 'light' || stored === 'dark'
                ? stored
                : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
              document.documentElement.dataset.theme = theme;
              document.documentElement.style.colorScheme = theme;
            } catch (error) {
              document.documentElement.dataset.theme = 'light';
              document.documentElement.style.colorScheme = 'light';
            }
          })();
        `}</Script>
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
