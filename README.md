# WooCommerce Manager

Windows-skrivbordsapp (Tauri + Next.js) för att hantera en WooCommerce-butik: ordrar, produkter/lager, kunder och en översikt med statistik. Ansluter direkt till butikens WooCommerce REST API — ingen egen server eller databas behövs.

## Utveckling

```bash
npm install
npm run tauri dev
```

Detta startar Next.js-dev-servern (port 3000) och öppnar appfönstret. Om port 3000 redan används av ett annat projekt, stäng det först eller ändra `devUrl` i `src-tauri/tauri.conf.json`.

## Bygga en installerbar version

```bash
npm run tauri build
```

Producerar en signerbar `.exe`/NSIS-installer i `src-tauri/target/release/bundle/`. En release-build använder alltid de inbyggda, statiskt exporterade filerna (inte `devUrl`).

## Ansluta till en butik

Öppna appen → Inställningar och ange:

1. Butikens webbadress (måste vara HTTPS)
2. Consumer Key och Consumer Secret från WooCommerce → Inställningar → Avancerat → REST API (behörighet "Läs/Skriv")

## API:er som används

- `wc/v3` (standard WooCommerce REST API) för allt som listar/skapar/ändrar — ordrar, produkter, kunder.
- `wc-analytics` (WooCommerce Admin/Analytics-API:et, inbyggt sedan WooCommerce 4.0) används bara för återbetalningssumman i månadsrapporten (se nedan) — inte för Översikt. Dess rapporttabeller fylls via en bakgrundssynk och låg efter för nya ordrar, så Översikts siffror för "Idag"/pågående perioder kunde visa noll trots riktiga ordrar. Översikt (`getDashboardStats` i `src/lib/woocommerce.ts`) hämtar därför ordrarna direkt via `wc/v3` och räknar ut försäljning/bästsäljare själv, precis som månadsrapporten.

## Månadsrapport (Rapporter-sidan)

Delar upp nettoförsäljning (exkl. moms) per butik/hämtställe för bokföring. Butiken avgörs av order-metadatafältet **`pickup_store`** (satt av butikens hämtningsplugin), med `pickup_store_id` som fallback. Ordrar utan något av fälten hamnar under "Okänd". Bygger på `getMonthlyReport` i `src/lib/woocommerce.ts` — räknar med ordrar i status Slutförd + Behandlas, och antar 6 % som enda momssats.

Återbetalningssumman hämtas från `wc-analytics/reports/revenue/stats` (samma anrop som Översikt använder) istället för att fråga varje enskild order om dess återbetalningar (`/orders/{id}/refunds`) — det senare krävde en förfrågan per order och fick butiker med många ordrar per månad att bli rate-limitade (429). Den lilla avvikelsen det kan innebära (wc-analytics egen definition av vilka orderstatusar som räknas) väger lätt mot att rapporten faktiskt går att generera.

## Släppa en ny version (auto-uppdatering)

Appen kollar automatiskt efter uppdateringar mot GitHub Releases för detta repo (`Hulter92/woocommerce-manager`). Så här släpper du en ny version:

1. Höj versionsnumret i `src-tauri/tauri.conf.json` (fältet `"version"`) och i `package.json`.
2. Committa ändringen, tagga den och pusha taggen:
   ```bash
   git add -A && git commit -m "Bump version to 0.2.0"
   git tag v0.2.0
   git push origin master --tags
   ```
3. GitHub Actions (`.github/workflows/release.yml`) bygger, signerar och publicerar automatiskt en Release med installerarna + `latest.json`. Ta en titt under repots "Actions"-flik för att följa förloppet.
4. Alla som redan har appen installerad får en banner i appen ("En ny version är tillgänglig") nästa gång de öppnar den, och kan uppdatera med ett klick.

Signeringsnyckeln (`src-tauri/updater.key`) finns bara lokalt på den här datorn och som hemligheterna `TAURI_SIGNING_PRIVATE_KEY`/`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` i GitHub-repots inställningar. Tappar du båda kan gamla installationer aldrig verifiera framtida uppdateringar — då måste alla installera om appen manuellt med en ny nyckel.

**Varför repot är publikt:** appens auto-uppdaterare hämtar `latest.json` och installerarna direkt från GitHub Releases utan att logga in. GitHub tillåter inte anonym nedladdning av Release-filer i privata repon, så repot måste vara publikt för att uppdateringskontrollen ska fungera. Inga hemligheter ligger i koden — signeringsnyckeln och API-nycklar till butiker är alltid lokala/hemligheter, aldrig incheckade.
