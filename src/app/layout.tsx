import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/components/settings-provider";
import { Sidebar } from "@/components/sidebar";
import { UpdateChecker } from "@/components/update-checker";

export const metadata: Metadata = {
  title: "WooCommerce Manager",
  description: "Hantera din WooCommerce-butik",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SettingsProvider>
          <UpdateChecker />
          <div className="flex flex-1 min-h-0">
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-y-auto p-6">{children}</main>
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
