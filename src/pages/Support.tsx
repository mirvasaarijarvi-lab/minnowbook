import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import {
  Search,
  CalendarDays,
  Mail,
  Settings,
  Users,
  CreditCard,
  HelpCircle,
  BookOpen,
  Palette,
  Clock,
} from "lucide-react";

interface GuideArticle {
  title: string;
  description: string;
  icon: React.ElementType;
  category: string;
  content: string[];
}

const articles: GuideArticle[] = [
  {
    title: "Getting Started",
    description: "Set up your account and create your first booking page in minutes.",
    icon: BookOpen,
    category: "Basics",
    content: [
      "Sign up for a free 30-day trial — no credit card needed.",
      "Complete the onboarding wizard to name your business and choose your reservation types.",
      "Customize your branding (logo, colors) in Settings.",
      "Share your booking link with customers!",
    ],
  },
  {
    title: "Managing Reservations",
    description: "View, edit, confirm, and cancel reservations from your dashboard.",
    icon: CalendarDays,
    category: "Reservations",
    content: [
      "Use the Calendar view for a visual overview of upcoming bookings.",
      "Switch to the List view to filter by status, type, or date range.",
      "Click any reservation to edit details, add notes, or change status.",
      "Confirmation and cancellation emails are sent automatically.",
    ],
  },
  {
    title: "Email Templates",
    description: "Customize confirmation and cancellation emails sent to guests.",
    icon: Mail,
    category: "Communication",
    content: [
      "Go to Settings → Email Templates to customize your emails.",
      "Preview how emails look before sending using the built-in preview.",
      "Add custom messages per reservation when confirming or cancelling.",
      "Emails support multi-language content (EN, FI, SV).",
    ],
  },
  {
    title: "Branding & Booking Page",
    description: "Customize your public booking page with your brand identity.",
    icon: Palette,
    category: "Customization",
    content: [
      "Upload your logo and set primary/accent colors in Settings.",
      "Add a hero image for your booking page header.",
      "Your booking page is available at /book/your-slug.",
      "Business description appears on the booking page for guests.",
    ],
  },
  {
    title: "Opening Hours",
    description: "Configure when your business accepts bookings for each type.",
    icon: Clock,
    category: "Configuration",
    content: [
      "Set opening hours per reservation type (restaurant, venue, hotel).",
      "Mark specific days as closed.",
      "Opening hours determine available time slots on the booking page.",
      "Use blocked slots to temporarily close specific dates.",
    ],
  },
  {
    title: "Resources & Rooms",
    description: "Manage rooms, tables, and event spaces that can be booked.",
    icon: Settings,
    category: "Configuration",
    content: [
      "Add resources in the Resources section of your dashboard.",
      "Set capacity, pricing, and descriptions for each resource.",
      "Upload photos to showcase your spaces on the booking page.",
      "Deactivate resources to temporarily hide them from bookings.",
    ],
  },
  {
    title: "Staff & User Management",
    description: "Invite team members and manage roles and permissions.",
    icon: Users,
    category: "Team",
    content: [
      "Owners can invite staff via the Admin panel.",
      "Roles: Owner (full access), Admin (manage resources), Staff (view reservations).",
      "Approve or remove team members at any time.",
      "Each plan has a staff user limit — upgrade to add more.",
    ],
  },
  {
    title: "Plans & Billing",
    description: "Understand pricing tiers and manage your subscription.",
    icon: CreditCard,
    category: "Billing",
    content: [
      "Basic (€29/mo) — 1 type, 1–3 staff, default templates.",
      "Pro (€79/mo) — 1 type, 10 staff, custom templates, analytics.",
      "Business (€199/mo) — All types, unlimited staff, dedicated support, AI chat.",
      "Upgrade or downgrade anytime. Changes take effect next billing cycle.",
    ],
  },
  {
    title: "Frequently Asked Questions",
    description: "Answers to the most common questions about MinnowBook.",
    icon: HelpCircle,
    category: "FAQ",
    content: [
      "Q: Do I need a credit card for the trial? A: No!",
      "Q: Can I use my own domain? A: Custom domains are on our roadmap.",
      "Q: How do guests receive confirmations? A: Automatically via email when you confirm a booking.",
      "Q: Can I export my data? A: Yes, reports can be exported from the Reports panel.",
    ],
  },
];

const Support = () => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.content.some((c) => c.toLowerCase().includes(q))
    );
  }, [search]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingHeader />

      {/* Hero */}
      <section className="py-16 md:py-24 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary-foreground mb-4">
            How can we help?
          </h1>
          <p className="text-lg text-primary-foreground/70 max-w-xl mx-auto mb-8">
            Browse guides, FAQs, and tips to get the most out of MinnowBook.
          </p>
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for help..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
        </div>
      </section>

      {/* Articles grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-lg">
              No results found. Try a different search term.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
              {filtered.map((article) => {
                const Icon = article.icon;
                return (
                  <details
                    key={article.title}
                    className="group rounded-2xl border border-border bg-card shadow-card hover:shadow-hover transition-shadow duration-300 overflow-hidden"
                  >
                    <summary className="flex items-start gap-4 p-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                        <Icon className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif font-semibold text-foreground text-base leading-tight">
                          {article.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {article.description}
                        </p>
                      </div>
                    </summary>
                    <div className="px-6 pb-6 pt-0 animate-fade-in">
                      <ul className="space-y-2 ml-14">
                        {article.content.map((item, i) => (
                          <li
                            key={i}
                            className="text-sm text-foreground/80 leading-relaxed flex items-start gap-2"
                          >
                            <span className="text-accent mt-0.5">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-secondary/50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
            Still need help?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Business plan customers have access to in-app AI support chat directly in the dashboard.
            For other plans, email us at support@minnowbook.com.
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
};

export default Support;
