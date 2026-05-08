import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "sonner";

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
    <html lang="pt-BR">
      <body data-theme="light">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
