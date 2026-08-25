"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useSettings } from "@/components/settings-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { normalizeStoreUrl, type WooSettings } from "@/lib/settings";
import { testConnection, WooCommerceApiError } from "@/lib/woocommerce";

type TestState = { status: "idle" | "testing" | "ok" | "error"; message?: string };

export default function InstallningarPage() {
  const { settings, loading, update } = useSettings();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return <InstallningarForm key={settings.storeUrl} initial={settings} update={update} />;
}

function InstallningarForm({
  initial,
  update,
}: {
  initial: WooSettings;
  update: (settings: WooSettings) => Promise<void>;
}) {
  const [storeUrl, setStoreUrl] = useState(initial.storeUrl);
  const [consumerKey, setConsumerKey] = useState(initial.consumerKey);
  const [consumerSecret, setConsumerSecret] = useState(initial.consumerSecret);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });

  async function handleTest() {
    setTest({ status: "testing" });
    try {
      await testConnection({
        storeUrl: normalizeStoreUrl(storeUrl),
        consumerKey,
        consumerSecret,
      });
      setTest({ status: "ok" });
    } catch (err) {
      const message = err instanceof WooCommerceApiError ? err.message : "Ett okänt fel uppstod.";
      setTest({ status: "error", message });
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await update({
        storeUrl: normalizeStoreUrl(storeUrl),
        consumerKey: consumerKey.trim(),
        consumerSecret: consumerSecret.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Inställningar</h1>
        <p className="text-sm text-muted mt-1">
          Anslut till din WooCommerce-butik med en REST API-nyckel.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="font-medium text-sm">Butiksanslutning</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="storeUrl">Butikens webbadress</Label>
            <Input
              id="storeUrl"
              placeholder="https://minbutik.se"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="consumerKey">Consumer Key</Label>
            <Input
              id="consumerKey"
              placeholder="ck_..."
              value={consumerKey}
              onChange={(e) => setConsumerKey(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="consumerSecret">Consumer Secret</Label>
            <Input
              id="consumerSecret"
              type="password"
              placeholder="cs_..."
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Spinner /> : null}
              Spara
            </Button>
            <Button variant="secondary" onClick={handleTest} disabled={test.status === "testing"}>
              {test.status === "testing" ? <Spinner /> : null}
              Testa anslutning
            </Button>
            {test.status === "ok" && (
              <span className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 size={16} /> Anslutningen fungerar
              </span>
            )}
            {test.status === "error" && (
              <span className="flex items-center gap-1.5 text-sm text-danger">
                <XCircle size={16} /> {test.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="font-medium text-sm">Så skapar du API-nycklar</p>
        </CardHeader>
        <CardContent>
          <ol className="text-sm text-muted list-decimal list-inside space-y-1.5">
            <li>Logga in i WordPress-adminen för din butik.</li>
            <li>Gå till WooCommerce → Inställningar → Avancerat → REST API.</li>
            <li>Klicka på &quot;Lägg till nyckel&quot;, ge den ett namn och sätt behörighet till &quot;Läs/Skriv&quot;.</li>
            <li>Kopiera Consumer Key och Consumer Secret hit. De visas bara en gång.</li>
          </ol>
          <p className="text-sm text-muted mt-3">
            Butiken måste använda HTTPS för att anslutningen ska fungera.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
