import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ClientProviders } from "@/components/client-providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lite Admin",
  description: "Dashboard for Lite Admin",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientProviders>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ClientProviders>
      </body>
    </html>
  );
}
