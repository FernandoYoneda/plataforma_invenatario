import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Casabella | Inventario TI",
  description: "Controle de inventario de ativos de TI da Casabella.",
  icons: {
    icon: "/branding/LOGO-CASABELLA-CIRCULO.png",
    apple: "/branding/LOGO-CASABELLA-CIRCULO.png",
  },
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
