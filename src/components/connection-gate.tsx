"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useSettings } from "@/components/settings-provider";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";

export function ConnectionGate({ children }: { children: React.ReactNode }) {
  const { loading, configured } = useSettings();

  if (loading) return <LoadingBlock />;

  if (!configured) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <p className="font-medium">Ingen butik ansluten än</p>
        <p className="text-sm text-muted max-w-sm">
          Lägg till din butiks webbadress och API-nycklar under Inställningar för att komma igång.
        </p>
        <Link href="/installningar">
          <Button size="sm" className="mt-2">
            <Settings size={15} />
            Gå till inställningar
          </Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
