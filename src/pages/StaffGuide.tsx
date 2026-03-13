import { useState } from "react";
import { useLanguage } from "@/contexts/I18nContext";
import { Language } from "@/i18n/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Printer, ArrowLeft, Home, Calendar, ClipboardList, BarChart3,
  Users, LogIn, Shield, Check, X, Lock, Pencil, Trash2, Search,
  Download, KeyRound, Settings, LifeBuoy, BookOpen, Building2, MapPin,
  Zap, Crown, Bell, Keyboard, UserCircle, Upload, Archive,
} from "lucide-react";
import { Link } from "react-router-dom";

type GuideContent = {
  title: string;
  subtitle: string;
  printBtn: string;
  back: string;
  tierOverview: {
    heading: string;
    tiers: { name: string; price: string; features: string[] }[];
  };
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
          {kpi.trend && <div className="text-[10px] text-success">{kpi.trend}</div>}
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
              "bg-success/10 text-success"
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
      <span className="flex items-center gap-1"><Check className="h-3 w-3 text-success" /> Available</span>
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
      <span className="px-2 py-1 rounded border text-warning">Pending 8</span>
      <span className="px-2 py-1 rounded border text-success">Confirmed 12</span>
      <span className="px-2 py-1 rounded border text-destructive">Cancelled 3</span>
      <span className="ml-auto px-2 py-1 rounded border bg-info/10 text-info font-medium">📅 Today</span>
    </div>
    <div className="space-y-1">
      {[
        { date: "03.03", guest: "John D.", type: "Hotel", status: "Confirmed", statusColor: "bg-success/10 text-success", used: true, invoiced: false },
        { date: "03.03", guest: "Lisa K.", type: "Restaurant", status: "Confirmed", statusColor: "bg-success/10 text-success", used: true, invoiced: true },
        { date: "03.03", guest: "Karl P.", type: "Venue", status: "Pending", statusColor: "bg-warning/10 text-warning", used: false, invoiced: false },
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
        { label: "NOT INVOICED", value: "3 800 €", color: "text-warning" },
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
          <span className="px-1.5 py-0.5 rounded bg-success/10 text-success text-[9px] w-fit">Active</span>
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
          <span className={`px-1.5 py-0.5 rounded text-[9px] ${u.approved ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
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
      <span className="font-medium">Support</span>
    </div>
    <div className="space-y-2 text-[10px]">
      <div className="p-2 rounded bg-background border">
        <div className="font-medium mb-1">All plans: AI Chatbot</div>
        <div className="text-muted-foreground">MimmoAid (💬) provides instant self-service help, quick guides, and AI-powered answers.</div>
      </div>
      <div className="p-2 rounded bg-accent/10 border border-accent/20">
        <div className="font-medium mb-1 text-accent">Business plan: Priority Support</div>
        <div className="text-muted-foreground">Submit tickets to admins with guaranteed 24-hour response. Track request status in real time.</div>
      </div>
    </div>
  </div>
);

const MockupMultisite = () => (
  <div className="border rounded-lg p-4 bg-muted/30 space-y-3 print:bg-white">
    <div className="flex items-center gap-2 text-xs font-medium">
      <Building2 className="h-4 w-4 text-primary" />
      <span>Sites</span>
      <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground">Business</span>
    </div>
    <div className="space-y-1">
      {[
        { name: "Wiurila Manor", type: "Venue", location: "Halikko", active: true },
        { name: "Gasthaus Wiurila", type: "Hotel", location: "Halikko", active: true },
        { name: "Restaurant Sigrid", type: "Restaurant", location: "Salo", active: false },
      ].map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-background border">
          <Building2 className="h-3 w-3 text-muted-foreground" />
          <span className="flex-1 font-medium">{s.name}</span>
          <span className="px-1.5 py-0.5 rounded border text-[9px]">{s.type}</span>
          <span className="flex items-center gap-0.5 text-muted-foreground"><MapPin className="h-2.5 w-2.5" />{s.location}</span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] ${s.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
            {s.active ? "Active" : "Draft"}
          </span>
        </div>
      ))}
    </div>
    <div className="flex gap-2 text-[10px]">
      <div className="flex-1 p-2 rounded bg-background border text-center">
        <div className="text-muted-foreground">Sidebar</div>
        <div className="mt-1 flex flex-col gap-0.5">
          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px]">All Sites</span>
          <span className="px-1.5 py-0.5 rounded border text-[9px]">Wiurila Manor</span>
          <span className="px-1.5 py-0.5 rounded border text-[9px]">Gasthaus</span>
        </div>
      </div>
      <div className="flex-1 p-2 rounded bg-background border text-center">
        <div className="text-muted-foreground">Site settings</div>
        <div className="mt-1 space-y-0.5 text-[9px] text-left px-1">
          <div>✓ Own opening hours</div>
          <div>✓ Own resources</div>
          <div>✓ Own email templates</div>
          <div>✓ Site-specific staff</div>
          <div>✓ Own branding & colors</div>
        </div>
      </div>
    </div>
  </div>
);

const MockupProfile = () => (
  <div className="border rounded-lg p-4 bg-muted/30 space-y-3 print:bg-white max-w-xs mx-auto">
    <div className="flex items-center gap-2 text-xs font-medium">
      <UserCircle className="h-4 w-4 text-primary" />
      <span>Profile Settings</span>
    </div>
    <div className="flex items-center gap-3">
      <div className="h-14 w-14 rounded-full bg-primary/10 border-2 border-border flex items-center justify-center text-sm font-bold text-primary">JD</div>
      <div className="space-y-1">
        <div className="h-6 rounded border bg-background px-2 flex items-center text-[10px]">
          <Upload className="h-2.5 w-2.5 mr-1 text-muted-foreground" /> Upload photo
        </div>
        <div className="text-[9px] text-muted-foreground">JPG, PNG or WebP. Max 2MB.</div>
      </div>
    </div>
    <div className="space-y-1.5 text-[10px]">
      <div className="text-muted-foreground">Display Name</div>
      <div className="h-7 rounded border bg-background px-2 flex items-center">John Doe</div>
      <div className="text-muted-foreground mt-1">Email</div>
      <div className="h-7 rounded border bg-muted px-2 flex items-center text-muted-foreground">john@example.com</div>
    </div>
    <div className="h-7 rounded bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-medium">Save Changes</div>
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
  multisite: <MockupMultisite />,
  profile: <MockupProfile />,
};

/* ─── Tier Overview Component ─── */

const TierOverviewCard = ({ tierOverview }: { tierOverview: GuideContent["tierOverview"] }) => {
  const tierIcons = [
    <Zap className="h-5 w-5" />,
    <Crown className="h-5 w-5" />,
    <Building2 className="h-5 w-5" />,
  ];

  return (
    <Card className="print:shadow-none print:border print:break-inside-avoid mb-8 print:mb-6 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3 print:pb-2">
        <CardTitle className="text-xl font-serif print:text-lg">{tierOverview.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
          {tierOverview.tiers.map((tier, idx) => (
            <div key={tier.name} className="rounded-xl border bg-card p-4 print:p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-primary print:text-black">{tierIcons[idx]}</span>
                <h3 className="font-semibold text-sm">{tier.name}</h3>
                <span className="ml-auto text-xs font-medium text-muted-foreground">{tier.price}</span>
              </div>
              <ul className="space-y-1">
                {tier.features.map((f, fi) => (
                  <li key={fi} className="flex items-start gap-1.5 text-xs text-foreground/80">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5 print:text-black" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

/* ─── Guide Content ─── */

const guideContent: Record<Language, GuideContent> = {
  en: {
    title: "Staff Quick Guide",
    subtitle: "MimmoBook – Staff User Manual",
    printBtn: "Print / Save as PDF",
    back: "Back to Dashboard",
    tierOverview: {
      heading: "Plans & Feature Access",
      tiers: [
        {
          name: "Basic",
          price: "€29/mo",
          features: [
            "1 reservation type (you choose)",
            "1 resource per type",
            "1–3 staff users",
            "Branded booking page",
            "Default email templates",
            "AI chatbot support",
          ],
        },
        {
          name: "Pro",
          price: "€79/mo",
          features: [
            "All reservation types (1 resource each)",
            "Up to 10 staff users",
            "Custom email templates",
            "Advanced booking rules",
            "Multi-language booking pages",
            "Analytics & reports",
            "AI chatbot support",
          ],
        },
        {
          name: "Business",
          price: "€199/mo",
          features: [
            "Unlimited sites & resources",
            "Unlimited staff users",
            "Multi-site management",
            "Per-site branding & settings",
            "Advanced revenue reporting",
            "Priority support (24h response)",
          ],
        },
      ],
    },
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
          "🔔 Notification bell (top-right): Alerts you when reservations are marked as 'Used' or 'Invoiced'. Unread count shown as a badge.",
          "⚠️ Action Alerts: Clickable banners highlight items needing attention — pending confirmations, uninvoiced reservations, and today's check-outs. Click to jump straight to the filtered view.",
          "Weekly KPIs: revenue, reservation count, guest count, and utilization rate.",
          "The weekly revenue chart shows daily revenue breakdown.",
          "Quick info section shows check-outs today and un-invoiced reservations.",
          "Today by type breakdown shows reservations per category.",
          "Your shareable public booking link is displayed at the bottom (site-specific links available for Business tier).",
          "⌨️ Keyboard shortcuts: Press Alt+1 through Alt+8 to quickly jump between sidebar sections (Overview, Calendar, Reservations, etc.).",
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
          "Compare mode lets you view two periods side by side.",
          "Pro & Business: Export CSV and Print report features are available.",
        ],
        tip: "All plans can view reports. CSV export and printing require Pro or Business.",
      },
      {
        icon: <Settings className="h-6 w-6" />, mockupId: "resources",
        title: "6. Resources",
        steps: [
          "The Resources view shows all venues, rooms, and tables.",
          "Each resource shows: name, type, description, capacity, pricing, and status.",
          "Click '+ Add Resource' to create a new resource.",
          "Basic & Pro plans: 1 resource per type. Business plan: unlimited resources.",
          "Upload images for each resource — these appear on the public booking page.",
          "For restaurant resources, you can set opening hours: toggle 'Opening hours' in the edit dialog.",
          "Choose 'Same every day' for uniform hours or 'Per day' to set different hours per weekday.",
          "Opening hours are displayed on the public booking page for guests to see.",
          "For restaurant resources, enable 'Offers catering' and/or 'Offers pop-up restaurant' under Additional Services.",
          "Catering: guests can request food delivery to their event with details like delivery address, dietary notes, equipment and staffing needs.",
          "Pop-up restaurant: your restaurant serves food at a guest's event or festival — the booking form captures event name, setup size, permits, and setup fee.",
          "These options only appear on the public booking page when at least one restaurant resource has them enabled.",
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
          "Email Templates: Customize confirmation, reminder, acknowledgment, and cancellation emails (Pro & Business).",
          "Basic plan uses default templates. Pro and Business can edit subject lines and body HTML per template type.",
          "Templates can be set per language (EN/FI/SV) and per site (Business plan).",
          "Discount Codes: Create promotional codes with percentage or fixed-amount discounts.",
          "Set usage limits, validity periods, minimum price thresholds, and which resource types the code applies to.",
          "Discount codes are automatically available on the public booking page for guests to enter at checkout.",
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
          "Approval Queue: Review and approve or reject pending changes from staff (resources, blocked slots, email templates, opening hours).",
          "Each item shows who requested it and when — approve with one click or reject with an optional reason.",
          "Manage shareable booking links: share links for all services, by service type (e.g. only restaurants), or by location.",
          "Booking links support ?type= to pre-select a service type and ?site= to lock to a specific location.",
        ],
      },
      {
        icon: <LifeBuoy className="h-6 w-6" />, mockupId: "support",
        title: "9. Support",
        steps: [
          "All plans include the MimmoAid AI chatbot (💬) — available in the dashboard and as a floating widget.",
          "Ask questions, browse quick guides, or get AI-powered answers instantly.",
          "Business plan adds priority support: submit tickets to admins with guaranteed 24-hour response.",
          "Track your ticket status in real time: Open → In Progress → Resolved.",
          "Admins can manage all support requests from the Support Board.",
        ],
      },
      {
        icon: <UserCircle className="h-6 w-6" />, mockupId: "profile",
        title: "10. Profile Settings",
        steps: [
          "Click 'Profile' in the sidebar to open your personal settings.",
          "Upload a profile photo (JPG, PNG, or WebP, max 2 MB) — it appears next to your name.",
          "Hover over your avatar and click ✕ to remove the current photo.",
          "Edit your Display Name — this is how other team members see you.",
          "Your email is shown for reference but cannot be changed here.",
          "Click 'Save Changes' to apply your updates.",
        ],
      },
      {
        icon: <Building2 className="h-6 w-6" />, mockupId: "multisite",
        title: "11. Multi-Site Management (Business plan)",
        steps: [
          "Business plan unlocks multi-site management — manage multiple locations from one dashboard.",
          "Create sites via Settings → Sites: give each a name, slug, and location.",
          "Use the sidebar site selector to switch between sites or view 'All Sites' for an aggregated view.",
          "Each site can have its own opening hours, resources, email templates, and staff assignments.",
          "Each site can override branding: custom colors, logo, business info.",
          "Site-specific settings override tenant defaults — use 'Reset to defaults' to revert.",
          "Assign staff to specific sites with distinct roles from the Admin panel.",
          "The public booking page adapts to show resources for the selected site via ?site= parameter.",
        ],
        tip: "Not on Business plan? You'll see an upgrade prompt in Settings.",
      },
      {
        icon: <Archive className="h-6 w-6" />, mockupId: "archive",
        title: "12. Automatic Archiving",
        steps: [
          "Reservations that are both marked as 'Used' and 'Invoiced' are automatically archived after 30 days.",
          "Archived reservations are moved to a separate archive and removed from the active reservation list.",
          "You can still view archived reservations — they retain all original details for reference.",
          "Archived items are permanently deleted after 400 days to keep storage clean.",
          "The archiving process runs automatically every night — no manual action is needed.",
        ],
        tip: "Make sure to mark reservations as both 'Used' and 'Invoiced' before they qualify for archiving.",
      },
    ],
  },
  fi: {
    title: "Henkilökunnan pikaopas",
    subtitle: "MimmoBook – käyttöohjeet henkilökunnalle",
    printBtn: "Tulosta / Tallenna PDF",
    back: "Takaisin hallintapaneeliin",
    tierOverview: {
      heading: "Tilaukset ja ominaisuudet",
      tiers: [
        {
          name: "Basic",
          price: "29 €/kk",
          features: [
            "1 varaustyyppi (valitset itse)",
            "1 resurssi per tyyppi",
            "1–3 henkilökuntaa",
            "Brändätty varaussivu",
            "Oletussähköpostimallit",
            "AI-chatbot-tuki",
          ],
        },
        {
          name: "Pro",
          price: "79 €/kk",
          features: [
            "Kaikki varaustyypit (1 resurssi per tyyppi)",
            "Jopa 10 henkilökuntaa",
            "Mukautetut sähköpostimallit",
            "Kehittyneet varaussäännöt",
            "Monikielinen varaussivu",
            "Analytiikka ja raportit",
            "AI-chatbot-tuki",
          ],
        },
        {
          name: "Business",
          price: "199 €/kk",
          features: [
            "Rajattomat toimipisteet ja resurssit",
            "Rajaton henkilökunta",
            "Monitoimipistehallinnointi",
            "Toimipistekohtainen brändäys",
            "Kehittyneet tuottoraportit",
            "Prioriteettituki (24h vasteaika)",
          ],
        },
      ],
    },
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
          "🔔 Ilmoituskello (oikeassa yläkulmassa): Ilmoittaa kun varauksia merkitään 'Käytetty' tai 'Laskutettu'. Lukemattomien määrä näkyy merkkinä.",
          "⚠️ Toimintahälytykset: Klikattavat bannerit korostavat huomiota vaativia kohteita — odottavat vahvistukset, laskuttamattomat varaukset ja päivän uloskirjaukset. Klikkaa siirtyäksesi suoraan suodatettuun näkymään.",
          "Viikon tunnusluvut: tuotto, varausmäärä, vierasmäärä ja käyttöaste.",
          "Viikon tuottokehitys -kaavio näyttää päiväkohtaisen tuoton.",
          "Pikatiedot-osio näyttää päivän uloskirjaukset ja laskuttamattomat varaukset.",
          "Tyypeittäin-osio näyttää varaukset kategorioittain.",
          "Julkinen varauslinkki näkyy sivun alaosassa (toimipistekohtaiset linkit Business-tilauksessa).",
          "⌨️ Pikanäppäimet: Paina Alt+1 – Alt+8 siirtyäksesi nopeasti sivupalkin osioiden välillä (Yleiskatsaus, Kalenteri, Varaukset jne.).",
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
          "Vertailutilassa voit tarkastella kahta ajanjaksoa rinnakkain.",
          "Pro & Business: CSV-vienti ja tulostus ovat käytettävissä.",
        ],
        tip: "Kaikki tilaukset voivat tarkastella raportteja. CSV-vienti ja tulostus vaativat Pro- tai Business-tilauksen.",
      },
      {
        icon: <Settings className="h-6 w-6" />, mockupId: "resources",
        title: "6. Resurssit",
        steps: [
          "Resurssien hallinta -näkymässä näet kaikki tilat, huoneet ja pöydät.",
          "Jokaiselle resurssille näkyy nimi, tyyppi, kuvaus, kapasiteetti, hinta ja tila.",
          "Paina '+ Lisää resurssi' lisätäksesi uuden resurssin.",
          "Basic & Pro: 1 resurssi per tyyppi. Business: rajattomat resurssit.",
          "Lataa kuvia resurssille — ne näkyvät julkisella varaussivulla.",
          "Ravintoloille voit asettaa aukioloajat: ota käyttöön 'Aukioloajat' muokkausnäkymässä.",
          "Valitse 'Sama joka päivä' yhtenäisille ajoille tai 'Päiväkohtainen' eri aikojen asettamiseen.",
          "Aukioloajat näkyvät julkisella varaussivulla asiakkaille.",
          "Ravintoloille voit ottaa käyttöön 'Tarjoaa catering-palvelua' ja/tai 'Tarjoaa pop-up-ravintolaa' kohdassa Lisäpalvelut.",
          "Catering: asiakkaat voivat tilata ruokatoimituksen tapahtumaansa — lomake kerää toimitusosoitteen, ruokavaliotiedot, laitetarpeet ja henkilökuntatarpeet.",
          "Pop-up-ravintola: ravintolasi tarjoilee ruokaa asiakkaan tapahtumassa tai festivaalilla — lomake kerää tapahtuman nimen, pystytyskoon, luvat ja pystytysmaksun.",
          "Nämä vaihtoehdot näkyvät julkisella varaussivulla vain, kun vähintään yhdellä ravintolatyyppisellä resurssilla on ne käytössä.",
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
          "Sähköpostipohjat: Muokkaa vahvistus-, muistutus-, kuittaus- ja peruutussähköposteja (Pro & Business).",
          "Basic-tilaus käyttää oletuspohjia. Pro ja Business voivat muokata otsikkorivejä ja HTML-sisältöä.",
          "Pohjat voidaan asettaa kielikohtaisesti (EN/FI/SV) ja toimipistekohtaisesti (Business-tilaus).",
          "Alennuskoodit: Luo tarjouskoodeja prosentti- tai euromääräisillä alennuksilla.",
          "Aseta käyttörajat, voimassaoloajat, minimihintarajat ja mihin resurssityyppeihin koodi pätee.",
          "Alennuskoodit ovat automaattisesti käytettävissä julkisella varaussivulla kassalla.",
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
          "Hyväksyntäjono: Tarkista ja hyväksy tai hylkää henkilökunnan tekemät muutokset (resurssit, estetyt ajat, sähköpostipohjat, aukioloajat).",
          "Jokainen kohde näyttää kuka sen pyysi ja milloin — hyväksy yhdellä klikkauksella tai hylkää valinnaisella syyllä.",
          "Hallitse jaettavia varauslinkkejä: jaa linkkejä kaikille palveluille, palvelutyypin mukaan (esim. vain ravintolat) tai sijainnin mukaan.",
          "Varauslinkit tukevat ?type= -parametria palvelutyypin esivalintaan ja ?site= -parametria sijainnin lukitsemiseen.",
        ],
      },
      {
        icon: <LifeBuoy className="h-6 w-6" />, mockupId: "support",
        title: "9. Tuki",
        steps: [
          "Kaikissa tilauksissa on MimmoAid AI-chatbot (💬) — käytettävissä hallintapaneelissa ja kelluvana widgettinä.",
          "Kysy kysymyksiä, selaa pikaoppaita tai saa AI-vastauksia välittömästi.",
          "Business-tilaus lisää prioriteettituen: lähetä tikettejä ylläpitäjille 24 tunnin vasteajalla.",
          "Seuraa tikettisi tilaa reaaliajassa: Avoin → Käsittelyssä → Ratkaistu.",
          "Ylläpitäjät voivat hallinnoida kaikkia tukipyyntöjä tukitaululta.",
        ],
      },
      {
        icon: <UserCircle className="h-6 w-6" />, mockupId: "profile",
        title: "10. Profiiliasetukset",
        steps: [
          "Paina 'Profiili' sivupalkissa avataksesi henkilökohtaiset asetukset.",
          "Lataa profiilikuva (JPG, PNG tai WebP, max 2 MB) — se näkyy nimesi vieressä.",
          "Vie hiiri avatarin päälle ja paina ✕ poistaaksesi nykyisen kuvan.",
          "Muokkaa näyttönimeäsi — tämä on miten muut tiimin jäsenet näkevät sinut.",
          "Sähköpostisi näkyy tiedoksi, mutta sitä ei voi muuttaa täältä.",
          "Paina 'Tallenna muutokset' ottaaksesi päivitykset käyttöön.",
        ],
      },
      {
        icon: <Building2 className="h-6 w-6" />, mockupId: "multisite",
        title: "11. Monitoimipistehallinnointi (Business)",
        steps: [
          "Business-tilaus avaa monitoimipistehallinnan — hallinnoi useita toimipisteitä yhdestä hallintapaneelista.",
          "Luo toimipisteitä Asetukset → Toimipisteet: anna nimi, slug ja sijainti.",
          "Käytä sivupalkin toimipistevalitsinta vaihtaaksesi toimipisteiden välillä tai valitse 'Kaikki toimipisteet' koostenäkymään.",
          "Jokaisella toimipisteellä voi olla omat aukioloajat, resurssit, sähköpostimallit ja henkilökuntaroolit.",
          "Jokaisella toimipisteellä voi olla oma brändäys: värit, logo, yritystiedot.",
          "Toimipistekohtaiset asetukset ohittavat organisaation oletukset — paina 'Palauta oletukset' palauttaaksesi.",
          "Määritä henkilökuntaa tiettyihin toimipisteisiin omilla rooleilla Admin-paneelista.",
          "Julkinen varaussivu mukautuu näyttämään valitun toimipisteen resurssit ?site= -parametrilla.",
        ],
        tip: "Ei Business-tilausta? Päivityskehote näkyy Asetuksissa.",
      },
      {
        icon: <Archive className="h-6 w-6" />, mockupId: "archive",
        title: "12. Automaattinen arkistointi",
        steps: [
          "Varaukset, jotka on merkitty sekä 'Käytetty' että 'Laskutettu', arkistoidaan automaattisesti 30 päivän jälkeen.",
          "Arkistoidut varaukset siirretään erilliseen arkistoon ja poistetaan aktiivisesta varauslistasta.",
          "Voit silti tarkastella arkistoituja varauksia — kaikki alkuperäiset tiedot säilyvät.",
          "Arkistoidut kohteet poistetaan pysyvästi 400 päivän jälkeen tallennustilan säästämiseksi.",
          "Arkistointiprosessi suoritetaan automaattisesti joka yö — manuaalisia toimenpiteitä ei tarvita.",
        ],
        tip: "Varmista, että varaukset on merkitty sekä 'Käytetty' että 'Laskutettu' ennen kuin ne siirtyvät arkistoon.",
      },
    ],
  },
  sv: {
    title: "Personalens snabbguide",
    subtitle: "MimmoBook – bruksanvisning för personalen",
    printBtn: "Skriv ut / Spara som PDF",
    back: "Tillbaka till instrumentpanelen",
    tierOverview: {
      heading: "Planer & funktionstillgång",
      tiers: [
        {
          name: "Basic",
          price: "29 €/mån",
          features: [
            "1 bokningstyp (du väljer)",
            "1 resurs per typ",
            "1–3 personalanvändare",
            "Anpassad bokningssida",
            "Standard e-postmallar",
            "AI-chatbot-support",
          ],
        },
        {
          name: "Pro",
          price: "79 €/mån",
          features: [
            "Alla bokningstyper (1 resurs per typ)",
            "Upp till 10 personal",
            "Anpassade e-postmallar",
            "Avancerade bokningsregler",
            "Flerspråkiga bokningssidor",
            "Analys & rapporter",
            "AI-chatbot-support",
          ],
        },
        {
          name: "Business",
          price: "199 €/mån",
          features: [
            "Obegränsade platser & resurser",
            "Obegränsad personal",
            "Hantering av flera platser",
            "Platsspecifik varumärkning",
            "Avancerade intäktsrapporter",
            "Prioritetssupport (24h svarstid)",
          ],
        },
      ],
    },
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
          "🔔 Aviseringsklocka (uppe till höger): Meddelar dig när bokningar markeras som 'Använd' eller 'Fakturerad'. Oläst antal visas som märke.",
          "⚠️ Åtgärdsvarningar: Klickbara banners markerar objekt som kräver uppmärksamhet — väntande bekräftelser, ej fakturerade bokningar och dagens utcheckningar. Klicka för att hoppa direkt till den filtrerade vyn.",
          "Veckans nyckeltal: intäkter, antal bokningar, antal gäster och beläggningsgrad.",
          "Veckans intäktsdiagram visar daglig intäktsfördelning.",
          "Snabbinfo visar dagens utcheckningar och ej fakturerade bokningar.",
          "Per typ visar bokningar per kategori.",
          "Din publika bokningslänk visas längst ner (platsspecifika länkar för Business-planen).",
          "⌨️ Tangentbordsgenvägar: Tryck Alt+1 till Alt+8 för att snabbt hoppa mellan sidofältets sektioner (Översikt, Kalender, Bokningar osv.).",
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
          "Jämförelseläge visar två perioder sida vid sida.",
          "Pro & Business: CSV-export och utskrift är tillgängliga.",
        ],
        tip: "Alla planer kan visa rapporter. CSV-export och utskrift kräver Pro eller Business.",
      },
      {
        icon: <Settings className="h-6 w-6" />, mockupId: "resources",
        title: "6. Resurser",
        steps: [
          "Resursvyn visar alla lokaler, rum och bord.",
          "Varje resurs visar: namn, typ, beskrivning, kapacitet, pris och status.",
          "Klicka '+ Lägg till resurs' för att skapa en ny resurs.",
          "Basic & Pro: 1 resurs per typ. Business: obegränsade resurser.",
          "Ladda upp bilder för varje resurs — de visas på den publika bokningssidan.",
          "För restaurangresurser kan du ställa in öppettider: aktivera 'Öppettider' i redigeringsdialogen.",
          "Välj 'Samma varje dag' för enhetliga tider eller 'Per dag' för olika tider per veckodag.",
          "Öppettiderna visas på den publika bokningssidan för gäster.",
          "För restaurangresurser, aktivera 'Erbjuder catering' och/eller 'Erbjuder pop-up-restaurang' under Tilläggstjänster.",
          "Catering: gäster kan beställa matleverans till sitt evenemang med detaljer som leveransadress, kostinformation, utrustnings- och personalbehov.",
          "Pop-up-restaurang: din restaurang serverar mat på gästens evenemang eller festival — bokningsformuläret samlar in evenemangsnamn, uppställningsstorlek, tillstånd och uppställningsavgift.",
          "Dessa alternativ visas bara på den publika bokningssidan när minst en restaurangresurs har dem aktiverade.",
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
          "E-postmallar: Anpassa bekräftelse-, påminnelse-, bekräftelse- och avbokningsmejl (Pro & Business).",
          "Basic-planen använder standardmallar. Pro och Business kan redigera ämnesrader och HTML-innehåll.",
          "Mallar kan ställas in per språk (EN/FI/SV) och per plats (Business-planen).",
          "Rabattkoder: Skapa kampanjkoder med procentuella eller fasta rabatter.",
          "Ange användningsgränser, giltighetstider, minimipriskrav och vilka resurstyper koden gäller.",
          "Rabattkoder är automatiskt tillgängliga på den publika bokningssidan vid kassan.",
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
          "Godkännandekö: Granska och godkänn eller avvisa väntande ändringar från personal (resurser, blockerade tider, e-postmallar, öppettider).",
          "Varje objekt visar vem som begärde det och när — godkänn med ett klick eller avvisa med valfri anledning.",
          "Hantera delbara bokningslänkar: dela länkar för alla tjänster, per tjänstetyp (t.ex. bara restauranger) eller per plats.",
          "Bokningslänkar stöder ?type= för att förvälja en tjänstetyp och ?site= för att låsa till en specifik plats.",
        ],
      },
      {
        icon: <LifeBuoy className="h-6 w-6" />, mockupId: "support",
        title: "9. Support",
        steps: [
          "Alla planer inkluderar MimmoAid AI-chattbot (💬) — tillgänglig i instrumentpanelen och som flytande widget.",
          "Ställ frågor, bläddra snabbguider eller få AI-drivna svar direkt.",
          "Business-planen lägger till prioritetssupport: skicka ärenden till administratörer med garanterad 24-timmars svarstid.",
          "Följ ditt ärendes status i realtid: Öppen → Pågår → Löst.",
          "Administratörer kan hantera alla supportförfrågningar från supporttavlan.",
        ],
      },
      {
        icon: <UserCircle className="h-6 w-6" />, mockupId: "profile",
        title: "10. Profilinställningar",
        steps: [
          "Klicka 'Profil' i sidofältet för att öppna dina personliga inställningar.",
          "Ladda upp ett profilfoto (JPG, PNG eller WebP, max 2 MB) — det visas bredvid ditt namn.",
          "Håll muspekaren över din avatar och klicka ✕ för att ta bort det aktuella fotot.",
          "Redigera ditt visningsnamn — så ser andra teammedlemmar dig.",
          "Din e-post visas som referens men kan inte ändras här.",
          "Klicka 'Spara ändringar' för att tillämpa dina uppdateringar.",
        ],
      },
      {
        icon: <Building2 className="h-6 w-6" />, mockupId: "multisite",
        title: "11. Hantering av flera platser (Business)",
        steps: [
          "Business-planen låser upp hantering av flera platser — hantera flera lokaler från en instrumentpanel.",
          "Skapa platser via Inställningar → Platser: ange namn, slug och plats.",
          "Använd sidofältets platsväljare för att växla mellan platser eller visa 'Alla platser' för en samlad vy.",
          "Varje plats kan ha egna öppettider, resurser, e-postmallar och personalroller.",
          "Varje plats kan ha eget varumärke: färger, logotyp, företagsuppgifter.",
          "Platsspecifika inställningar åsidosätter standardinställningar — klicka 'Återställ till standard' för att återgå.",
          "Tilldela personal till specifika platser med distinkta roller från Admin-panelen.",
          "Den publika bokningssidan anpassas för att visa resurser för den valda platsen via ?site= parameter.",
        ],
        tip: "Inte på Business-planen? Du ser en uppgraderingsuppmaning i Inställningar.",
      },
      {
        icon: <Archive className="h-6 w-6" />, mockupId: "archive",
        title: "12. Automatisk arkivering",
        steps: [
          "Bokningar som är markerade som både 'Använd' och 'Fakturerad' arkiveras automatiskt efter 30 dagar.",
          "Arkiverade bokningar flyttas till ett separat arkiv och tas bort från den aktiva bokningslistan.",
          "Du kan fortfarande visa arkiverade bokningar — alla ursprungliga detaljer bevaras.",
          "Arkiverade poster raderas permanent efter 400 dagar för att hålla lagringen ren.",
          "Arkiveringsprocessen körs automatiskt varje natt — ingen manuell åtgärd behövs.",
        ],
        tip: "Se till att markera bokningar som både 'Använd' och 'Fakturerad' innan de kvalificerar för arkivering.",
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

        {/* Tier Overview - first page */}
        <TierOverviewCard tierOverview={content.tierOverview} />

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
          MimmoBook – {content.title} – {new Date().toLocaleDateString(guideLang === "fi" ? "fi-FI" : guideLang === "sv" ? "sv-SE" : "en-GB")}
        </div>
      </main>
    </div>
  );
};

export default StaffGuide;
