"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, Package, Settings, ShoppingCart, Users } from "lucide-react";
import { useSettings } from "@/components/settings-provider";

const links = [
  { href: "/", label: "Översikt", icon: LayoutDashboard },
  { href: "/ordrar", label: "Ordrar", icon: ShoppingCart },
  { href: "/produkter", label: "Produkter", icon: Package },
  { href: "/kunder", label: "Kunder", icon: Users },
  { href: "/rapporter", label: "Rapporter", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { configured } = useSettings();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-4 py-4 border-b border-border">
        <p className="font-semibold text-sm">WooCommerce Manager</p>
        <p className="text-xs text-muted mt-0.5">
          {configured ? "Ansluten" : "Ej konfigurerad"}
        </p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted-bg"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t border-border">
        <Link
          href="/installningar"
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
            pathname === "/installningar"
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-muted-bg"
          }`}
        >
          <Settings size={16} />
          Inställningar
        </Link>
      </div>
    </aside>
  );
}
