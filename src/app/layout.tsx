import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@/components/Analytics";

export const metadata: Metadata = {
  title: "Click & Collect",
  description: "Commande en ligne, retrait en boutique.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <Analytics />
        {children}
      </body>
    </html>
  );
}
