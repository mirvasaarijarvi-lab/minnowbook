import { useState } from "react";
import { useLanguage } from "@/contexts/I18nContext";
import { Language } from "@/i18n/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Printer, ArrowLeft, Home, Calendar, ClipboardList, BarChart3,
  Users, LogIn, Shield, Check, X, Lock, Pencil, Trash2, Search,
  Download, KeyRound, Settings, LifeBuoy, BookOpen,
} from "lucide-react";
import { Link } from "react-router-dom";

type GuideContent = {
  title: string;
  subtitle: string;
  printBtn: string;
  back: string;
  sections: {
    icon: React.ReactNode;
    title: string;
    steps: string[];
    tip?: string;
    mockupId: string;
  }[];
};

/* ─── Visual Mockup Components ─── */

const MockupLogin = () => (
  <div className="border rounded-lg p-4 bg-muted/30 space-y-3 max-w-xs mx-auto print:bg-white">
    <div className="flex gap-2 border-b pb-2">
      <span className="text-xs font-medium px-3 py-1 rounded bg-primary/10 text-primary">Log in</span>
      <span className="text-xs font-medium px-3 py-1 rounded text-muted-foreground">Sign up</span>
    </div>
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">Email</div>
      <div className="h-8 rounded border bg-background px-2 flex items-center text-xs text-muted-foreground">user@example.com</div>
      <div className="text-xs text-muted-foreground">Password</div>
      <div className="h-8 rounded border bg-background px-2 flex items-center text-xs text-muted-foreground">••••••••</div>
    </div>
    <div className="h-8 rounded bg-primary flex items-center justify-center text-xs text-primary-foreground font-medium">Log in</div>
    <div className="text-[10px] text-center text-muted-foreground underline">Forgot password?</div>
  </div>
);

const MockupOverview = () => (
  <div className="border rounded-lg p-4 bg-muted/30 space-y-3 print:bg-white">
    <div className="grid grid-cols-4 gap-2">
      {[
        { label: "Today", value: "5", icon: "📅" },
        { label: "Pending", value: "3", icon: "⏳" },
        { label: "Guests", value: "24", icon: "👥" },
        { label: "Arrived", value: "2/5", icon: "✅" },
      ].map((kpi) => (
        <div key={kpi.label} className="text-center p-2 rounded bg-background border">
          <div className="text-sm">{kpi.icon}</div>
          <div className="font-bold text-sm">{kpi.value}</div>
          <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-4 gap-2">
      {[
        { label: "Week revenue", value: "2 450 €", trend: "+12%" },
        { label: "Reservations", value: "18", trend: "+5%" },
        { label: "Guests", value: "156", trend: "+8%" },
        { label: "Utilization", value: "72%", trend: "" },
      ].map((kpi) => (
        <div key={kpi.label} className="text-center p-2 rounded bg-background border">
          <div className="font-bold text-sm">{kpi.value}</div>
          <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
          {kpi.trend && <div className="text-[10px] text-green-600">{kpi.trend}</div>}
        </div>
      ))}
    </div>
    <div className="h-16 rounded bg-background border p-2">
      <div className="text-[10px] text-muted-foreground mb-1">Weekly revenue trend</div>
      <div className="flex items-end gap-1 h-8">
        {[40, 65, 80, 50, 70, 30, 90].map((h, i) => (
          <div key={i} className="flex-1 bg-primary/20 rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  </div>
);

const MockupCalendar = () => (
  <div className="border rounded-lg p-4 bg-muted/30 space-y-3 print:bg-white">
    <div className="flex items-center justify-between">
      <span className="text-xs">← Mar 3 – Mar 9, 2026 →</span>
      <div className="flex gap-1">
        <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border">Restaurant</span>
        <span className="text-[10px] px-2 py-0.5 rounded border">Venue</span>
        <span className="text-[10px] px-2 py-0.5 rounded border">Hotel</span>
      </div>
    </div>
    <div className="grid grid-cols-7 gap-1 text-[10px]">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
        <div key={d} className="text-center font-medium text-muted-foreground">{d}</div>
      ))}
      {Array.from({ length: 7 }).map((_, day) => (
        <div key={day} className="space-y-0.5">
          {["Restaurant", "Venue Hall", "Room 1"].map((room, ri) => (
            <div key={ri} className={`text-[9px] px-1 py-0.5 rounded flex items-center gap-1 ${
              ri === 1 && day === 2 ? "bg-destructive/10 text-destructive" :
              ri === 2 && day === 5 ? "bg-muted text-muted-foreground" :
              "bg-green-50 text-green-700"
            }`}>
              {ri === 1 && day === 2 ? <X className="h-2 w-2" /> :
               ri === 2 && day === 5 ? <Lock className="h-2 w-2" /> :
               <Check className="h-2 w-2" />}
              {room}
            </div>
          ))}
        </div>
      ))}
    </div>
    <div className="flex gap-3 text-[10px] justify-center text-muted-foreground">
      <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-600" /> Available</span>
      <span className="flex items-center gap-1"><X className="h-3 w-3 text-destructive" /> Full</span>
      <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Blocked</span>
    </div>
  </div>
);

const MockupReservations = () => (
  <div className="border rounded-lg p-4 bg-muted/30 space-y-3 print:bg-white">
    <div className="flex gap-2 items-center">
      <div className="flex-1 h-8 rounded border bg-background px-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Search className="h-3 w-3" /> Search by name, email...
      </div>
      <div className="h-8 rounded bg-primary px-3 flex items-center text-xs text-primary-foreground">+ New Reservation</div>
    </div>
    <div className="flex gap-1 text-[10px] flex-wrap">
      <span className="px-2 py-1 rounded bg-primary text-primary-foreground">All 23</span>
      <span className="px-2 py-1 rounded border text-amber-600">Pending 8</span>
      <span className="px-2 py-1 rounded border text-green-600">Confirmed 12</span>
      <span className="px-2 py-1 rounded border text-destructive">Cancelled 3</span>
      <span className="ml-auto px-2 py-1 rounded border bg-blue-50 text-blue-700 font-medium">📅 Today</span>
    </div>
    <div className="space-y-1">
      {[
        { date: "03.03", guest: "John D.", type: "Hotel", status: "Confirmed", statusColor: "bg-green-100 text-green-700", used: true, invoiced: false },
        { date: "03.03", guest: "Lisa K.", type: "Restaurant", status: "Confirmed", statusColor: "bg-green-100 text-green-700", used: true, invoiced: true },
        { date: "03.03", guest: "Karl P.", type: "Venue", status: "Pending", statusColor: "bg-amber-100 text-amber-700", used: false, invoiced: false },
      ].map((r, i) => (
        <div key={i} className="grid grid-cols-[3rem_1fr_4rem_4.5rem_1.5rem_1.5rem_1rem] gap-1 items-center text-[10px] p-2 rounded bg-background border">
          <span className="text-muted-foreground">{r.date}</span>
          <span className="font-medium">{r.guest}</span>
          <span>{r.type}</span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] text-center ${r.statusColor}`}>{r.status}</span>
          <div className={`w-3.5 h-3.5 rounded border ${r.used ? 'bg-primary border-primary' : 'border-muted-foreground'} flex items-center justify-center`}>
            {r.used && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
          </div>
          <div className={`w-3.5 h-3.5 rounded border ${r.invoiced ? 'bg-primary border-primary' : 'border-muted-foreground'} flex items-center justify-center`}>
            {r.invoiced && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
          </div>
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </div>
      ))}
    </div>
  </div>
);

const MockupReports = () => (
  <div className="border rounded-lg p-4 bg-muted/30 space-y-3 print:bg-white">
    <div className="flex gap-2 items-center text-[10px]">
      <span className="px-2 py-1 rounded border">Weekly report</span>
      <span className="px-2 py-1 rounded border">Mar 3 – 9, 2026</span>
      <span className="ml-auto flex items-center gap-1 px-2 py-1 rounded border"><Download className="h-3 w-3" /> CSV</span>
      <span className="flex items-center gap-1 px-2 py-1 rounded border"><Printer className="h-3 w-3" /> Print</span>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: "INVOICED", value: "1 200 €", color: "text-foreground" },
        { label: "NOT INVOICED", value: "3 800 €", color: "text-amber-600" },
        { label: "TOTAL", value: "5 000 €", color: "text-foreground" },
      ].map((kpi) => (
        <div key={kpi.label} className="p-2 rounded bg-background border text-center">
          <div className="text-[9px] text-muted-foreground">{kpi.label}</div>
          <div className={`font-bold text-sm ${kpi.color}`}>{kpi.value}</div>
        </div>
      ))}
    </div>
  </div>
);

const MockupResources = () => (
  <div className="border rounded-lg p-4 bg-muted/30 space-y-3 print:bg-white">
    <div className="flex justify-end">
      <div className="h-7 rounded bg-primary px-3 flex items-center text-xs text-primary-foreground">+ Add resource</div>
    </div>
    <div className="space-y-1 text-[10px]">
      {[
        { name: "Restaurant Sigrid", type: "Restaurant", cap: "60", active: true },
        { name: "Grand Hall", type: "Venue", cap: "180", active: true },
        { name: "Room 1", type: "Hotel", cap: "2", active: true },
      ].map((r, i) => (
        <div key={i} className="grid grid-cols-5 gap-1 p-1.5 rounded bg-background border items-center">
          <span className="font-medium">{r.name}</span>
          <span>{r.type}</span>
          <span>{r.cap}</span>
          <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[9px] w-fit">Active</span>
          <span className="flex gap-1">
            <Pencil className="h-3 w-3 text-muted-foreground" />
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </span>
        </div>
      ))}
    </div>
  </div>
);

const MockupSettings = () => (
  <div className="border rounded-lg p-4 bg-muted/30 space-y-3 print:bg-white">
    <div className="space-y-2 text-[10px]">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className="text-muted-foreground">Business name</div>
          <div className="h-7 rounded border bg-background px-2 flex items-center">My Business</div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">Email</div>
          <div className="h-7 rounded border bg-background px-2 flex items-center">info@business.com</div>
        </div>
      </div>
      <div className="text-muted-foreground mt-2">Brand Colors</div>
      <div className="flex gap-2">
        <div className="w-8 h-8 rounded bg-primary border" />
        <div className="w-8 h-8 rounded bg-secondary border" />
        <div className="w-8 h-8 rounded bg-accent border" />
      </div>
    </div>
  </div>
);

const MockupAdmin = () => (
  <div className="border rounded-lg p-4 bg-muted/30 space-y-3 print:bg-white">
    <div className="text-xs font-medium text-muted-foreground">Users</div>
    <div className="space-y-1">
      {[
        { name: "Admin User", role: "admin", approved: true },
        { name: "Staff User", role: "staff", approved: true },
        { name: "New User", role: "staff", approved: false },
      ].map((u, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-background border">
          <span className="flex-1 font-medium">{u.name}</span>
          <span className="px-1.5 py-0.5 rounded border text-[9px]">{u.role}</span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] ${u.approved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {u.approved ? "Approved" : "Pending"}
          </span>
          <KeyRound className="h-3 w-3 text-muted-foreground" />
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </div>
      ))}
    </div>
  </div>
);

const MockupSupport = () => (
  <div className="border rounded-lg p-4 bg-muted/30 space-y-3 print:bg-white">
    <div className="flex items-center gap-2 text-xs">
      <LifeBuoy className="h-4 w-4 text-primary" />
      <span className="font-medium">Support Requests</span>
    </div>
    <div className="space-y-1">
      {[
        { subject: "Cannot log in", status: "Open", color: "bg-amber-100 text-amber-700" },
        { subject: "Feature request", status: "Resolved", color: "bg-green-100 text-green-700" },
      ].map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-background border">
          <span className="flex-1">{r.subject}</span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] ${r.color}`}>{r.status}</span>
        </div>
      ))}
    </div>
  </div>
);

const mockupComponents: Record<string, React.ReactNode> = {
  login: <MockupLogin />,
  overview: <MockupOverview />,
  calendar: <MockupCalendar />,
  reservations: <MockupReservations />,
  reports: <MockupReports />,
  resources: <MockupResources />,
  settings: <MockupSettings />,
  admin: <MockupAdmin />,
  support: <MockupSupport />,
};

/* ─── Guide Content ─── */

const guideContent: Record<Language, GuideContent> = {
  en: {
    title: "Staff Quick Guide",
    subtitle: "MinnowBook – Staff User Manual",
    printBtn: "Print / Save as PDF",
    back: "Back to Dashboard",
    sections: [
      {
        icon: <LogIn className="h-6 w-6" />, mockupId: "login",
        title: "1. Logging In",
        steps: [
          "Navigate to the Login page in your browser.",
          "Enter your email and password.",
          "Click the 'Log in' button.",
          "New users: Your administrator creates your account via the Admin panel.",
          "Forgot your password? Click the 'Forgot password?' link on the login page.",
        ],
        tip: "Password must be at least 6 characters long.",
      },
      {
        icon: <Home className="h-6 w-6" />, mockupId: "overview",
        title: "2. Dashboard Overview",
        steps: [
          "The Overview tab shows today's summary: reservations, pending bookings, guests, and arrivals.",
          "Weekly KPIs: revenue, reservation count, guest count, and utilization rate.",
          "The weekly revenue chart shows daily revenue breakdown.",
          "Quick info section shows check-outs today and un-invoiced reservations.",
          "Today by type breakdown shows reservations per category.",
          "Your shareable public booking link is displayed at the bottom.",
        ],
      },
      {
        icon: <Calendar className="h-6 w-6" />, mockupId: "calendar",
        title: "3. Calendar",
        steps: [
          "The weekly calendar displays all resources and their availability.",
          "Navigate weeks using arrow buttons (← →).",
          "Filter resources by type: Restaurant, Venue, Hotel/Guesthouse.",
          "Color codes: ✓ Available (green), ✕ Full (red), 🔒 Blocked (gray).",
          "Click a day to open the day view with all reservations.",
          "Block individual dates or create recurring weekly blocks for any resource type.",
        ],
      },
      {
        icon: <ClipboardList className="h-6 w-6" />, mockupId: "reservations",
        title: "4. Reservations",
        steps: [
          "The Reservations view lists bookings by status: Pending, Confirmed, Cancelled.",
          "Use the search bar to find reservations by name, email, or phone.",
          "Filter by type, status, invoicing status, and date range.",
          "Quick filters: click 'Today' to see today's reservations.",
          "Click '+ New Reservation' to create a manual booking.",
          "Click the edit icon (✏) to modify a reservation's details.",
          "Mark a reservation as Used directly from the list by clicking the checkbox — no need to open the edit dialog.",
          "Mark as Invoiced the same way via the Invoiced checkbox column.",
          "Tip: click 'Today', then tick Used for arrived guests and Invoiced for billed ones — all directly from the list!",
        ],
      },
      {
        icon: <BarChart3 className="h-6 w-6" />, mockupId: "reports",
        title: "5. Reports",
        steps: [
          "Select a time period: Week, Month, Quarter, Half-year, Year, or custom range.",
          "Filter by invoicing status (all, invoiced, not invoiced).",
          "KPIs: invoiced, not invoiced, total, room revenue, breakfast revenue.",
          "Reservation counts are broken down by type.",
          "Export CSV button downloads data as a spreadsheet.",
          "Print button creates a printer-friendly version.",
          "Compare mode lets you view two periods side by side.",
        ],
      },
      {
        icon: <Settings className="h-6 w-6" />, mockupId: "resources",
        title: "6. Resources",
        steps: [
          "The Resources view shows all venues, rooms, and tables.",
          "Each resource shows: name, type, description, capacity, pricing, and status.",
          "Click '+ Add Resource' to create a new resource.",
          "Upload images for each resource — these appear on the public booking page.",
          "Edit or delete resources as needed.",
        ],
      },
      {
        icon: <Settings className="h-6 w-6" />, mockupId: "settings",
        title: "7. Settings (Owner only)",
        steps: [
          "Upload your logo and hero image for the public booking page.",
          "Edit business details: name, email, phone, address, description.",
          "Customize brand colors with presets or custom hex values.",
          "Give custom display names to your resource types (e.g. 'Ravintola Sigrid' instead of 'Restaurant').",
          "Set availability thresholds to control when dates show as full.",
        ],
      },
      {
        icon: <Shield className="h-6 w-6" />, mockupId: "admin",
        title: "8. Admin Panel (Owner/Admin)",
        steps: [
          "Manage all users: add new users, change roles, reset passwords, or remove users.",
          "Roles: Owner (full access), Admin (most access), Staff (basic access).",
          "Create custom roles with granular permissions using the Permissions Editor.",
          "View login history and audit log for security monitoring.",
          "Manage shareable booking links for each resource type.",
        ],
      },
      {
        icon: <LifeBuoy className="h-6 w-6" />, mockupId: "support",
        title: "9. Support",
        steps: [
          "Submit support requests to your administrator from the Support tab.",
          "Track your request status: Open, In Progress, Resolved.",
          "Admins can respond to requests and manage the support board.",
          "Use MinnowAid (💬) floating chat for quick self-service help anytime.",
        ],
      },
    ],
  },
  fi: {
    title: "Henkilökunnan pikaopas",
    subtitle: "MinnowBook – käyttöohjeet henkilökunnalle",
    printBtn: "Tulosta / Tallenna PDF",
    back: "Takaisin hallintapaneeliin",
    sections: [
      {
        icon: <LogIn className="h-6 w-6" />, mockupId: "login",
        title: "1. Kirjautuminen",
        steps: [
          "Avaa kirjautumissivu selaimessa.",
          "Syötä sähköpostiosoitteesi ja salasanasi.",
          "Paina 'Kirjaudu sisään' -painiketta.",
          "Uudet käyttäjät: Ylläpitäjä luo tilisi Admin-paneelista.",
          "Unohditko salasanan? Paina 'Unohditko salasanan?' -linkkiä kirjautumissivulla.",
        ],
        tip: "Salasanan tulee olla vähintään 6 merkkiä pitkä.",
      },
      {
        icon: <Home className="h-6 w-6" />, mockupId: "overview",
        title: "2. Hallintapaneelin yleiskatsaus",
        steps: [
          "Yleiskatsaus-välilehti näyttää päivän yhteenvedon: varaukset, odottavat, vieraat ja saapuneet.",
          "Viikon tunnusluvut: tuotto, varausmäärä, vierasmäärä ja käyttöaste.",
          "Viikon tuottokehitys -kaavio näyttää päiväkohtaisen tuoton.",
          "Pikatiedot-osio näyttää päivän uloskirjaukset ja laskuttamattomat varaukset.",
          "Tyypeittäin-osio näyttää varaukset kategorioittain.",
          "Julkinen varauslinkki näkyy sivun alaosassa.",
        ],
      },
      {
        icon: <Calendar className="h-6 w-6" />, mockupId: "calendar",
        title: "3. Kalenteri",
        steps: [
          "Viikkokalenteri näyttää kaikki resurssit ja niiden saatavuuden.",
          "Vaihda viikkoa nuolipainikkeilla (← →).",
          "Suodata resursseja tyypeittäin: Ravintola, Tilat, Hotelli/Gasthaus.",
          "Värikoodit: ✓ Vapaa (vihreä), ✕ Täynnä (punainen), 🔒 Suljettu (harmaa).",
          "Klikkaa päivää avataksesi päivänäkymän, jossa näet kaikki varaukset.",
          "Estä yksittäisiä päiviä tai luo viikoittain toistuvia estoja resurssityypeille.",
        ],
      },
      {
        icon: <ClipboardList className="h-6 w-6" />, mockupId: "reservations",
        title: "4. Varaukset",
        steps: [
          "Varaukset-näkymä listaa varaukset tilan mukaan: Odottaa, Vahvistettu, Peruttu.",
          "Käytä hakukenttää etsiäksesi varausta nimen, sähköpostin tai puhelinnumeron perusteella.",
          "Suodata tyyppi-, tila-, laskutus- ja aikavälisuodattimilla.",
          "Pikasuodatin: paina 'Tänään' nähdäksesi päivän varaukset.",
          "Paina '+ Uusi varaus' luodaksesi uuden varauksen.",
          "Paina kynäkuvaketta (✏) muokataksesi varausta.",
          "Merkitse varaus käytetyksi suoraan listasta klikkaamalla checkboxia — ei tarvitse avata muokkausnäkymää.",
          "Merkitse laskutetuksi samalla tavalla Laskutettu-sarakkeen checkboxista.",
          "Vinkki: paina 'Tänään', merkitse saapuneiden varaukset käytetyiksi ja laskutetut laskutetuiksi — kaikki suoraan listasta!",
        ],
      },
      {
        icon: <BarChart3 className="h-6 w-6" />, mockupId: "reports",
        title: "5. Raportit",
        steps: [
          "Valitse aikaväli: Viikko, Kuukausi, Neljännes, Puoli vuotta, Vuosi tai oma aikaväli.",
          "Suodata laskutustilan mukaan (kaikki, laskutettu, ei laskutettu).",
          "Tunnusluvut: laskutettu, ei laskutettu, yhteensä, huonetulo, aamupalatulo.",
          "Varausmäärät eriteltynä tyypeittäin.",
          "Vie CSV -painikkeella saat tiedot laskentataulukkoon.",
          "Tulosta-painikkeella voit tulostaa raportin.",
          "Vertailutilassa voit tarkastella kahta ajanjaksoa rinnakkain.",
        ],
      },
      {
        icon: <Settings className="h-6 w-6" />, mockupId: "resources",
        title: "6. Resurssit",
        steps: [
          "Resurssien hallinta -näkymässä näet kaikki tilat, huoneet ja pöydät.",
          "Jokaiselle resurssille näkyy nimi, tyyppi, kuvaus, kapasiteetti, hinta ja tila.",
          "Paina '+ Lisää resurssi' lisätäksesi uuden resurssin.",
          "Lataa kuvia resurssille — ne näkyvät julkisella varaussivulla.",
          "Muokkaa tai poista resursseja tarpeen mukaan.",
        ],
      },
      {
        icon: <Settings className="h-6 w-6" />, mockupId: "settings",
        title: "7. Asetukset (vain omistaja)",
        steps: [
          "Lataa logo ja hero-kuva julkiselle varaussivulle.",
          "Muokkaa yritystietoja: nimi, sähköposti, puhelin, osoite, kuvaus.",
          "Muokkaa brändivärejä valmiilla malleilla tai omilla hex-arvoilla.",
          "Anna omat näyttönimet varauskohteillesi (esim. 'Ravintola Sigrid' pelkän 'Ravintola' sijaan).",
          "Aseta saatavuusrajat hallitaksesi milloin päivät näkyvät täysinä.",
        ],
      },
      {
        icon: <Shield className="h-6 w-6" />, mockupId: "admin",
        title: "8. Ylläpito (omistaja/ylläpitäjä)",
        steps: [
          "Hallitse käyttäjiä: lisää, vaihda roolia, vaihda salasana tai poista.",
          "Roolit: Omistaja (täysi käyttöoikeus), Ylläpitäjä (laaja käyttöoikeus), Henkilökunta (peruskäyttö).",
          "Luo mukautettuja rooleja yksityiskohtaisilla oikeuksilla.",
          "Näytä kirjautumishistoria ja muutosloki turvallisuuden seurantaan.",
          "Hallitse jaettavia varauslinkkejä resurssityypeittäin.",
        ],
      },
      {
        icon: <LifeBuoy className="h-6 w-6" />, mockupId: "support",
        title: "9. Tuki",
        steps: [
          "Lähetä tukipyyntöjä ylläpitäjälle Tuki-välilehdeltä.",
          "Seuraa pyyntösi tilaa: Avoin, Käsittelyssä, Ratkaistu.",
          "Ylläpitäjät voivat vastata pyyntöihin ja hallinnoida tukitaulua.",
          "Käytä MinnowAid (💬) -chattia nopeaan itsepalveluun milloin tahansa.",
        ],
      },
    ],
  },
  sv: {
    title: "Personalens snabbguide",
    subtitle: "MinnowBook – bruksanvisning för personalen",
    printBtn: "Skriv ut / Spara som PDF",
    back: "Tillbaka till instrumentpanelen",
    sections: [
      {
        icon: <LogIn className="h-6 w-6" />, mockupId: "login",
        title: "1. Inloggning",
        steps: [
          "Öppna inloggningssidan i din webbläsare.",
          "Ange din e-postadress och ditt lösenord.",
          "Klicka på 'Logga in'-knappen.",
          "Nya användare: Administratören skapar ditt konto via Admin-panelen.",
          "Glömt lösenordet? Klicka på 'Glömt lösenordet?'-länken på inloggningssidan.",
        ],
        tip: "Lösenordet måste vara minst 6 tecken långt.",
      },
      {
        icon: <Home className="h-6 w-6" />, mockupId: "overview",
        title: "2. Instrumentpanelens översikt",
        steps: [
          "Översiktsfliken visar dagens sammanfattning: bokningar, väntande, gäster och ankomster.",
          "Veckans nyckeltal: intäkter, antal bokningar, antal gäster och beläggningsgrad.",
          "Veckans intäktsdiagram visar daglig intäktsfördelning.",
          "Snabbinfo visar dagens utcheckningar och ej fakturerade bokningar.",
          "Per typ visar bokningar per kategori.",
          "Din publika bokningslänk visas längst ner.",
        ],
      },
      {
        icon: <Calendar className="h-6 w-6" />, mockupId: "calendar",
        title: "3. Kalender",
        steps: [
          "Veckokalendern visar alla resurser och deras tillgänglighet.",
          "Navigera veckor med pilknapparna (← →).",
          "Filtrera resurser efter typ: Restaurang, Lokal, Hotell/Gasthaus.",
          "Färgkoder: ✓ Ledig (grön), ✕ Fullbokad (röd), 🔒 Blockerad (grå).",
          "Klicka på en dag för att öppna dagsvyn med alla bokningar.",
          "Blockera enskilda datum eller skapa återkommande veckovisa blockeringar.",
        ],
      },
      {
        icon: <ClipboardList className="h-6 w-6" />, mockupId: "reservations",
        title: "4. Bokningar",
        steps: [
          "Bokningsvyn listar bokningar efter status: Väntande, Bekräftad, Avbokad.",
          "Använd sökfältet för att hitta bokningar med namn, e-post eller telefonnummer.",
          "Filtrera efter typ, status, fakturering och datumintervall.",
          "Snabbfilter: klicka 'Idag' för att se dagens bokningar.",
          "Klicka '+ Ny bokning' för att skapa en manuell bokning.",
          "Klicka på redigeringsikonen (✏) för att ändra en bokning.",
          "Markera en bokning som använd direkt från listan genom att klicka på kryssrutan — du behöver inte öppna redigeringsdialogen.",
          "Markera som fakturerad på samma sätt via kolumnen Fakturerad.",
          "Tips: klicka 'Idag', markera anlända gästers bokningar som använda och fakturerade — allt direkt från listan!",
        ],
      },
      {
        icon: <BarChart3 className="h-6 w-6" />, mockupId: "reports",
        title: "5. Rapporter",
        steps: [
          "Välj tidsperiod: Vecka, Månad, Kvartal, Halvår, År eller anpassat intervall.",
          "Filtrera efter faktureringsstatus (alla, fakturerade, ej fakturerade).",
          "Nyckeltal: fakturerat, ej fakturerat, totalt, rumsintäkter, frukostintäkter.",
          "Bokningsantal per typ.",
          "Exportera CSV-knappen laddar ner data som kalkylblad.",
          "Skriv ut-knappen skapar en utskriftsvänlig version.",
          "Jämförelseläge visar två perioder sida vid sida.",
        ],
      },
      {
        icon: <Settings className="h-6 w-6" />, mockupId: "resources",
        title: "6. Resurser",
        steps: [
          "Resursvyn visar alla lokaler, rum och bord.",
          "Varje resurs visar: namn, typ, beskrivning, kapacitet, pris och status.",
          "Klicka '+ Lägg till resurs' för att skapa en ny resurs.",
          "Ladda upp bilder för varje resurs — de visas på den publika bokningssidan.",
          "Redigera eller ta bort resurser efter behov.",
        ],
      },
      {
        icon: <Settings className="h-6 w-6" />, mockupId: "settings",
        title: "7. Inställningar (Endast ägare)",
        steps: [
          "Ladda upp logotyp och hero-bild för den publika bokningssidan.",
          "Redigera företagsuppgifter: namn, e-post, telefon, adress, beskrivning.",
          "Anpassa varumärkesfärger med förval eller egna hex-värden.",
          "Ge egna visningsnamn åt dina bokningstyper (t.ex. 'Restaurang Sigrid' istället för 'Restaurang').",
          "Ställ in tillgänglighetströsklar för att kontrollera när datum visas som fullbokade.",
        ],
      },
      {
        icon: <Shield className="h-6 w-6" />, mockupId: "admin",
        title: "8. Adminpanel (Ägare/Admin)",
        steps: [
          "Hantera alla användare: lägg till, ändra roll, återställ lösenord eller ta bort.",
          "Roller: Ägare (full åtkomst), Admin (bred åtkomst), Personal (grundläggande).",
          "Skapa anpassade roller med detaljerade behörigheter.",
          "Visa inloggningshistorik och ändringslogg för säkerhetsövervakning.",
          "Hantera delbara bokningslänkar per resurstyp.",
        ],
      },
      {
        icon: <LifeBuoy className="h-6 w-6" />, mockupId: "support",
        title: "9. Support",
        steps: [
          "Skicka supportförfrågningar till administratören från Support-fliken.",
          "Följ din förfrågan: Öppen, Pågår, Löst.",
          "Administratörer kan svara och hantera supporttavlan.",
          "Använd MinnowAid (💬) chattbot för snabb självhjälp när som helst.",
        ],
      },
    ],
  },
};

/* ─── Main Component ─── */

const StaffGuide = () => {
  const { language } = useLanguage();
  const [guideLang, setGuideLang] = useState<Language>(language);
  const content = guideContent[guideLang];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Screen-only header */}
      <header className="print:hidden bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {content.back}
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            {(["fi", "en", "sv"] as Language[]).map((lang) => (
              <Button
                key={lang}
                variant={guideLang === lang ? "default" : "outline"}
                size="sm"
                onClick={() => setGuideLang(lang)}
                className="w-10"
              >
                {lang.toUpperCase()}
              </Button>
            ))}
            <Button onClick={handlePrint} size="sm" className="ml-2">
              <Printer className="h-4 w-4 mr-2" />
              {content.printBtn}
            </Button>
          </div>
        </div>
      </header>

      {/* Guide content */}
      <main className="max-w-4xl mx-auto px-4 py-8 print:py-4 print:px-8 print:max-w-none">
        {/* Title */}
        <div className="text-center mb-10 print:mb-6">
          <h1 className="text-3xl font-serif font-bold text-foreground print:text-2xl">{content.title}</h1>
          <p className="text-muted-foreground mt-2 print:text-sm">{content.subtitle}</p>
          <p className="text-xs text-muted-foreground mt-1 print:block hidden">
            {new Date().toLocaleDateString(guideLang === "fi" ? "fi-FI" : guideLang === "sv" ? "sv-SE" : "en-GB")}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8 print:space-y-6">
          {content.sections.map((section, idx) => (
            <Card key={idx} className="print:shadow-none print:border print:break-inside-avoid">
              <CardHeader className="pb-3 print:pb-2">
                <CardTitle className="flex items-center gap-3 text-xl font-serif print:text-lg">
                  <span className="text-primary print:text-black">{section.icon}</span>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mockup illustration */}
                {mockupComponents[section.mockupId] && (
                  <div className="mb-4">
                    {mockupComponents[section.mockupId]}
                  </div>
                )}

                {/* Steps */}
                <ol className="space-y-2 print:space-y-1">
                  {section.steps.map((step, stepIdx) => (
                    <li key={stepIdx} className="flex gap-3 text-sm print:text-xs">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold print:bg-gray-200 print:text-black">
                        {stepIdx + 1}
                      </span>
                      <span className="text-foreground pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
                {section.tip && (
                  <div className="mt-3 p-3 rounded-md bg-muted text-sm text-muted-foreground print:bg-gray-100 print:text-xs">
                    💡 {section.tip}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer for print */}
        <div className="hidden print:block mt-8 pt-4 border-t text-center text-xs text-gray-500">
          MinnowBook – {content.title} – {new Date().toLocaleDateString(guideLang === "fi" ? "fi-FI" : guideLang === "sv" ? "sv-SE" : "en-GB")}
        </div>
      </main>
    </div>
  );
};

export default StaffGuide;
