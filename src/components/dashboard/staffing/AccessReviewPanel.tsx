import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, FileDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { StaffLang } from "@/lib/staffing/labels";
import { memberSiteIds } from "@/lib/staffing/siteScope";
import { accessSnapshot } from "@/lib/staffing/accessSnapshot";
import { useStaffingSettings } from "@/hooks/useShiftList";
import { reviewDue } from "@/lib/staffing/accessReviewDue";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  type AuditPeriod,
  filterForAuditPeriod,
  accessReviewFileName,
  renderAccessReviewPdf,
  type AccessReviewReport,
} from "@/lib/staffing/accessReviewPdf";
import {
  buildSiteHistory,
  changeAffectsSite,
} from "@/lib/staffing/accessReviewHistory";

const LABELS = {
  en: {
    intro:
      "Check who can use each location. Add a change request for anything that looks wrong, then accept the location once all requests are handled.",
    signIn: "Can sign in and see this location",
    shiftStaff: "Works here on shift lists",
    allLoc: "all locations",
    owner: "Owner",
    admin: "Admin",
    staff: "Staff",
    superadmin: "Superadmin",
    notApproved: "not approved",
    none: "Nobody",
    unassigned: "Staff accounts with no location, so they see no bookings:",
    request: "Request change",
    notePh: "What should change?",
    add: "Add",
    openReq: "Change requests",
    done: "Done",
    dismiss: "Dismiss",
    accept: "Accept access",
    acceptBlocked: "Handle all change requests before accepting.",
    accepted: "Accepted",
    lastAccepted: "Last accepted {date}",
    never: "Not reviewed yet",
    changed: "Access changed since last review",
    ok: "Saved",
    noSites: "Add a location first.",
    worksAt: "Works at",
    severalLoc: "several locations",
    removeHere: "Remove from this location",
    giveAccess: "Give sign-in access to this location",
    changesLog: "Location changes",
    changeMoved: "{name}: works at {from} → {to}",
    changeAdded: "{name}: got sign-in access",
    changeRemoved: "{name}: sign-in access removed",
    byWho: "by {name}",
    notReviewedChanges: "Location changes (not reviewed yet)",
    history: "Review history",
    acceptedBy: "Accepted {date} by {name}",
    untilNext: "Changes before the next review on {date}",
    untilNow: "Changes since then, up to now",
    noChanges: "No access changes",
    gainedSignIn: "Got sign-in access",
    lostSignIn: "Lost sign-in access",
    addedShift: "Added to shift lists",
    removedShift: "Removed from shift lists",
    handled: "Handled change requests",
    reqDone: "done",
    reqDismissed: "dismissed",
    unknown: "Removed person",
    pdf: "Download audit PDF",
    pdfTitle: "Access review audit report",
    pdfGenerated: "Generated",
    pdfStatus: "Review status",
    pdfInterval: "Review interval",
    pdfCurrent: "Current access",
    pdfOpen: "Open change requests",
    pdfNone: "None",
    pdfFooter: "MimmoBook access review report",
    pdfFailed: "Could not create the PDF",
    pdfPeriod: "Audit period",
    pdfAllHistory: "All history",
    pdfFrom: "From",
    pdfTo: "To",
    pdfPeriodHint: "Leave empty to include all history.",
    pdfDownload: "Download PDF",
    pdfNoneInPeriod: "No reviews accepted in this period",
    pdfBadRange: "The start date must be on or before the end date",
    pdfPeriodText: "{from} to {to}",
    pdfStart: "start",
    pdfNow: "today",
    reviewEvery: "Review each location every",
    daysN: "{n} days",
    overdueBy: "Review overdue by {days} days",
    dueOn: "Next review due {date}",
    reviewNeeded: "Review needed",
  },
  fi: {
    intro:
      "Tarkista, kuka voi käyttää kutakin toimipistettä. Lisää muutospyyntö kaikesta, mikä näyttää väärältä, ja hyväksy toimipiste, kun pyynnöt on käsitelty.",
    signIn: "Voi kirjautua ja nähdä tämän toimipisteen",
    shiftStaff: "Työskentelee täällä työvuorolistoilla",
    allLoc: "kaikki toimipisteet",
    owner: "Omistaja",
    admin: "Ylläpitäjä",
    staff: "Henkilökunta",
    superadmin: "Pääkäyttäjä",
    notApproved: "ei hyväksytty",
    none: "Ei ketään",
    unassigned:
      "Henkilökunnan tilit ilman toimipistettä, joten ne eivät näe varauksia:",
    request: "Pyydä muutosta",
    notePh: "Mitä pitäisi muuttaa?",
    add: "Lisää",
    openReq: "Muutospyynnöt",
    done: "Tehty",
    dismiss: "Hylkää",
    accept: "Hyväksy käyttöoikeudet",
    acceptBlocked: "Käsittele kaikki muutospyynnöt ennen hyväksymistä.",
    accepted: "Hyväksytty",
    lastAccepted: "Hyväksytty viimeksi {date}",
    never: "Ei vielä tarkistettu",
    changed: "Käyttöoikeudet muuttuneet edellisen tarkistuksen jälkeen",
    ok: "Tallennettu",
    noSites: "Lisää ensin toimipiste.",
    worksAt: "Työpaikka",
    severalLoc: "useita toimipisteitä",
    removeHere: "Poista tästä toimipisteestä",
    giveAccess: "Anna kirjautumisoikeus tähän toimipisteeseen",
    changesLog: "Toimipistemuutokset",
    changeMoved: "{name}: työpaikka {from} → {to}",
    changeAdded: "{name}: sai kirjautumisoikeuden",
    changeRemoved: "{name}: kirjautumisoikeus poistettu",
    byWho: "tekijä {name}",
    notReviewedChanges: "Toimipistemuutokset (ei vielä tarkistettu)",
    history: "Tarkistushistoria",
    acceptedBy: "Hyväksynyt {name}, {date}",
    untilNext: "Muutokset ennen seuraavaa tarkistusta {date}",
    untilNow: "Muutokset sen jälkeen tähän päivään",
    noChanges: "Ei muutoksia käyttöoikeuksiin",
    gainedSignIn: "Sai kirjautumisoikeuden",
    lostSignIn: "Menetti kirjautumisoikeuden",
    addedShift: "Lisätty työvuorolistoille",
    removedShift: "Poistettu työvuorolistoilta",
    handled: "Käsitellyt muutospyynnöt",
    reqDone: "tehty",
    reqDismissed: "hylätty",
    unknown: "Poistettu henkilö",
    pdf: "Lataa tarkastusraportti (PDF)",
    pdfTitle: "Käyttöoikeuksien tarkastusraportti",
    pdfGenerated: "Luotu",
    pdfStatus: "Tarkistuksen tila",
    pdfInterval: "Tarkistusväli",
    pdfCurrent: "Nykyiset käyttöoikeudet",
    pdfOpen: "Avoimet muutospyynnöt",
    pdfNone: "Ei yhtään",
    pdfFooter: "MimmoBook käyttöoikeusraportti",
    pdfFailed: "PDF:n luominen epäonnistui",
    pdfPeriod: "Tarkastusjakso",
    pdfAllHistory: "Koko historia",
    pdfFrom: "Alkaen",
    pdfTo: "Asti",
    pdfPeriodHint: "Jätä tyhjäksi, niin mukana on koko historia.",
    pdfDownload: "Lataa PDF",
    pdfNoneInPeriod: "Ei hyväksyttyjä tarkistuksia tällä jaksolla",
    pdfBadRange: "Alkupäivän täytyy olla sama tai ennen loppupäivää",
    pdfPeriodText: "{from} ja {to} välillä",
    pdfStart: "alusta",
    pdfNow: "tähän päivään",
    reviewEvery: "Tarkista jokainen toimipiste",
    daysN: "{n} päivän välein",
    overdueBy: "Tarkistus myöhässä {days} päivää",
    dueOn: "Seuraava tarkistus {date}",
    reviewNeeded: "Tarkistus tarvitaan",
  },
  sv: {
    intro:
      "Kontrollera vem som kan använda varje plats. Lägg till en ändringsbegäran för det som ser fel ut och godkänn platsen när alla begäranden är hanterade.",
    signIn: "Kan logga in och se den här platsen",
    shiftStaff: "Arbetar här på arbetsscheman",
    allLoc: "alla platser",
    owner: "Ägare",
    admin: "Administratör",
    staff: "Personal",
    superadmin: "Superadmin",
    notApproved: "inte godkänd",
    none: "Ingen",
    unassigned: "Personalkonton utan plats, så de ser inga bokningar:",
    request: "Begär ändring",
    notePh: "Vad ska ändras?",
    add: "Lägg till",
    openReq: "Ändringsbegäranden",
    done: "Klar",
    dismiss: "Avfärda",
    accept: "Godkänn behörigheter",
    acceptBlocked: "Hantera alla ändringsbegäranden innan du godkänner.",
    accepted: "Godkänd",
    lastAccepted: "Senast godkänd {date}",
    never: "Inte granskad än",
    changed: "Behörigheterna har ändrats sedan senaste granskningen",
    ok: "Sparat",
    noSites: "Lägg till en plats först.",
    worksAt: "Arbetar på",
    severalLoc: "flera platser",
    removeHere: "Ta bort från den här platsen",
    giveAccess: "Ge inloggning till den här platsen",
    changesLog: "Platsändringar",
    changeMoved: "{name}: arbetar på {from} → {to}",
    changeAdded: "{name}: fick inloggning",
    changeRemoved: "{name}: inloggning borttagen",
    byWho: "av {name}",
    notReviewedChanges: "Platsändringar (inte granskade än)",
    history: "Granskningshistorik",
    acceptedBy: "Godkänd {date} av {name}",
    untilNext: "Ändringar före nästa granskning {date}",
    untilNow: "Ändringar sedan dess, fram till nu",
    noChanges: "Inga ändringar i behörigheter",
    gainedSignIn: "Fick inloggning",
    lostSignIn: "Förlorade inloggning",
    addedShift: "Tillagd på arbetsscheman",
    removedShift: "Borttagen från arbetsscheman",
    handled: "Hanterade ändringsbegäranden",
    reqDone: "klar",
    reqDismissed: "avfärdad",
    unknown: "Borttagen person",
    pdf: "Ladda ner granskningsrapport (PDF)",
    pdfTitle: "Granskningsrapport för behörigheter",
    pdfGenerated: "Skapad",
    pdfStatus: "Granskningsstatus",
    pdfInterval: "Granskningsintervall",
    pdfCurrent: "Nuvarande behörigheter",
    pdfOpen: "Öppna ändringsbegäranden",
    pdfNone: "Inga",
    pdfFooter: "MimmoBook behörighetsrapport",
    pdfFailed: "Det gick inte att skapa PDF-filen",
    pdfPeriod: "Granskningsperiod",
    pdfAllHistory: "Hela historiken",
    pdfFrom: "Från",
    pdfTo: "Till",
    pdfPeriodHint: "Lämna tomt för att ta med hela historiken.",
    pdfDownload: "Ladda ner PDF",
    pdfNoneInPeriod: "Inga godkända granskningar under perioden",
    pdfBadRange: "Startdatumet måste vara samma som eller före slutdatumet",
    pdfPeriodText: "{from} till {to}",
    pdfStart: "början",
    pdfNow: "i dag",
    reviewEvery: "Granska varje plats var",
    daysN: "{n}:e dag",
    overdueBy: "Granskningen är {days} dagar försenad",
    dueOn: "Nästa granskning {date}",
    reviewNeeded: "Granskning behövs",
  },
} as const;

type Person = {
  kind: "user" | "staff";
  id: string;
  name: string;
  tag: string;
  muted?: boolean;
  role?: string;
  siteIds?: string[] | null;
};

export default function AccessReviewPanel({
  lang,
  focus,
}: {
  lang: StaffLang;
  /** Location to scroll to; n changes on every request so repeats work. */
  focus?: { siteId: string; n: number } | null;
}) {
  const L = LABELS[lang];
  const { tenantId, tenant, isOwner, isAdmin } = useTenant();
  const canEditSignIn = isOwner || isAdmin;
  const qc = useQueryClient();
  const key = ["access-review", tenantId];
  const { settings, save: saveSettings } = useStaffingSettings();
  const interval = settings.accessReviewDays;

  const { data } = useQuery({
    queryKey: key,
    enabled: !!tenantId,
    queryFn: async () => {
      const t = tenantId!;
      const [
        sites,
        users,
        siteUsers,
        staff,
        reviews,
        requests,
        allStaff,
        handled,
        changes,
      ] = await Promise.all([
        supabase
          .from("sites")
          .select("id,name")
          .eq("tenant_id", t)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("tenant_users")
          .select("user_id,display_name,role,is_approved")
          .eq("tenant_id", t),
        supabase
          .from("site_users")
          .select("site_id,user_id")
          .eq("tenant_id", t),
        supabase
          .from("staff_members")
          .select("id,name,site_id,site_ids,is_active")
          .eq("tenant_id", t)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("site_access_reviews")
          .select("id,site_id,snapshot,accepted_by,accepted_at")
          .eq("tenant_id", t)
          .order("accepted_at", { ascending: false }),
        supabase
          .from("site_access_change_requests")
          .select("id,site_id,subject_name,note,created_at")
          .eq("tenant_id", t)
          .eq("status", "open")
          .order("created_at"),
        supabase.from("staff_members").select("id,name").eq("tenant_id", t),
        supabase
          .from("site_access_change_requests")
          .select("id,site_id,subject_name,note,status,resolved_at")
          .eq("tenant_id", t)
          .neq("status", "open"),
        supabase
          .from("site_access_change_log")
          .select(
            "id,action,subject_id,subject_name,old_site_id,new_site_id,old_site_ids,new_site_ids,changed_by,changed_at",
          )
          .eq("tenant_id", t)
          .order("changed_at", { ascending: false })
          .limit(1000),
      ]);
      for (const r of [
        sites,
        users,
        siteUsers,
        staff,
        reviews,
        requests,
        allStaff,
        handled,
        changes,
      ])
        if (r.error) throw r.error;
      return {
        sites: sites.data ?? [],
        users: users.data ?? [],
        siteUsers: siteUsers.data ?? [],
        staff: staff.data ?? [],
        reviews: reviews.data ?? [],
        requests: requests.data ?? [],
        allStaff: allStaff.data ?? [],
        handled: handled.data ?? [],
        changes: changes.data ?? [],
      };
    },
  });

  const roleLabel = (r: string) => (L as Record<string, string>)[r] ?? r;

  const perSite = useMemo(() => {
    if (!data) return [];
    return data.sites.map((s) => {
      const signIn: Person[] = data.users
        .filter(
          (u) =>
            u.role !== "staff" ||
            data.siteUsers.some(
              (su) => su.site_id === s.id && su.user_id === u.user_id,
            ),
        )
        .map((u) => ({
          kind: "user",
          role: u.role,
          id: u.user_id,
          name: u.display_name || u.user_id.slice(0, 8),
          tag:
            u.role === "staff"
              ? roleLabel(u.role)
              : `${roleLabel(u.role)}, ${L.allLoc}`,
          muted: !u.is_approved,
        }));
      const shift: Person[] = data.staff
        .filter((m) => {
          const ids = memberSiteIds(m);
          return ids === null || ids.includes(s.id);
        })
        .map((m) => ({
          kind: "staff",
          siteIds: memberSiteIds(m),
          id: m.id,
          name: m.name,
          tag:
            memberSiteIds(m) === null
              ? L.allLoc
              : (memberSiteIds(m) ?? []).length > 1
                ? (memberSiteIds(m) ?? [])
                    .map((id) => data.sites.find((x) => x.id === id)?.name)
                    .filter(Boolean)
                    .join(", ")
                : "",
        }));
      const snapshot = accessSnapshot(
        s.id,
        data.users,
        data.siteUsers,
        data.staff,
      );
      const last = data.reviews.find((r) => r.site_id === s.id);
      const changed =
        !!last && JSON.stringify(last.snapshot) !== JSON.stringify(snapshot);
      return {
        site: s,
        signIn,
        shift,
        snapshot,
        last,
        changed,
        requests: data.requests.filter((r) => r.site_id === s.id),
        history: buildSiteHistory(
          s.id,
          data.reviews,
          snapshot,
          data.handled,
          data.changes,
        ),
        unreviewedChanges: data.reviews.some((r) => r.site_id === s.id)
          ? []
          : data.changes.filter((c) => changeAffectsSite(c, s.id)),
        addable: data.users.filter(
          (u) =>
            u.role === "staff" &&
            !data.siteUsers.some(
              (su) => su.site_id === s.id && su.user_id === u.user_id,
            ),
        ),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lang]);

  const unassigned = (data?.users ?? []).filter(
    (u) =>
      u.role === "staff" &&
      !(data?.siteUsers ?? []).some((su) => su.user_id === u.user_id),
  );

  const hasSites = perSite.length > 0;
  useEffect(() => {
    if (!focus || !hasSites) return;
    const el = document.getElementById(`access-site-${focus.siteId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.focus({ preventScroll: true });
  }, [focus, hasSites]);

  const onErr = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : String(e));
  const refresh = () => {
    toast.success(L.ok);
    qc.invalidateQueries({ queryKey: key });
  };

  const addReq = useMutation({
    mutationFn: async (v: { siteId: string; p: Person; note: string }) => {
      const { error } = await supabase
        .from("site_access_change_requests")
        .insert({
          tenant_id: tenantId!,
          site_id: v.siteId,
          subject_kind: v.p.kind,
          subject_id: v.p.id,
          subject_name: v.p.name,
          note: v.note,
        });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: onErr,
  });

  const resolve = useMutation({
    mutationFn: async (v: { id: string; status: "done" | "dismissed" }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("site_access_change_requests")
        .update({
          status: v.status,
          resolved_by: u.user?.id ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: onErr,
  });

  const accept = useMutation({
    mutationFn: async (v: { siteId: string; snapshot: object }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("site_access_reviews").insert({
        tenant_id: tenantId!,
        site_id: v.siteId,
        snapshot: v.snapshot as never,
        accepted_by: u.user!.id,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: onErr,
  });

  const moveStaff = useMutation({
    mutationFn: async (v: { id: string; siteIds: string[] }) => {
      const { error } = await supabase
        .from("staff_members")
        .update({ site_ids: v.siteIds })
        .eq("id", v.id)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: onErr,
  });

  const setSignIn = useMutation({
    mutationFn: async (v: { userId: string; siteId: string; on: boolean }) => {
      const { error } = v.on
        ? await supabase.from("site_users").insert({
            tenant_id: tenantId!,
            site_id: v.siteId,
            user_id: v.userId,
          } as never)
        : await supabase
            .from("site_users")
            .delete()
            .eq("tenant_id", tenantId!)
            .eq("site_id", v.siteId)
            .eq("user_id", v.userId);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: onErr,
  });

  const [draft, setDraft] = useState<{
    siteId: string;
    p: Person;
    note: string;
  } | null>(null);

  if (data && data.sites.length === 0)
    return <p className="text-sm text-muted-foreground">{L.noSites}</p>;

  const fmt = (d: string) =>
    new Date(d).toLocaleString(
      lang === "fi" ? "fi-FI" : lang === "sv" ? "sv-SE" : "en-GB",
    );

  const userName = (id: string) => {
    const u = data?.users.find((x) => x.user_id === id);
    return u ? u.display_name || id.slice(0, 8) : L.unknown;
  };
  const staffName = (id: string) =>
    data?.allStaff.find((x) => x.id === id)?.name ?? L.unknown;

  const siteName = (id: string | null) =>
    id === null
      ? L.allLoc
      : (data?.sites.find((x) => x.id === id)?.name ?? L.unknown);
  const describeChange = (c: {
    action: string;
    subject_name: string;
    old_site_id: string | null;
    new_site_id: string | null;
    old_site_ids?: string[] | null;
    new_site_ids?: string[] | null;
    changed_by: string | null;
    changed_at: string;
  }) => {
    const places = (ids: string[] | null | undefined, one: string | null) =>
      ids
        ? ids.length
          ? ids.map(siteName).join(", ")
          : L.allLoc
        : siteName(one);
    const name = c.subject_name || L.unknown;
    const text =
      c.action === "staff_moved"
        ? L.changeMoved
            .replace("{name}", name)
            .replace("{from}", places(c.old_site_ids, c.old_site_id))
            .replace("{to}", places(c.new_site_ids, c.new_site_id))
        : (c.action === "signin_added"
            ? L.changeAdded
            : L.changeRemoved
          ).replace("{name}", name);
    const by = c.changed_by
      ? ` ${L.byWho.replace("{name}", userName(c.changed_by))}`
      : "";
    return `${fmt(c.changed_at)}: ${text}${by}`;
  };

  const dueText = (last: string | null | undefined) => {
    const d = reviewDue(last, interval);
    return d.state === "overdue"
      ? L.overdueBy.replace("{days}", String(d.daysOverdue))
      : d.state === "never"
        ? L.reviewNeeded
        : L.dueOn.replace("{date}", fmt(d.dueAt!.toISOString()));
  };

  const exportPdf = async (
    s: (typeof perSite)[number],
    period: AuditPeriod = {},
  ): Promise<boolean> => {
    if (period.from && period.to && period.from > period.to) {
      toast.error(L.pdfBadRange);
      return false;
    }
    try {
      const now = new Date();
      const hasPeriod = !!(period.from || period.to);
      const dayText = (d: string) => fmt(`${d}T12:00:00`);
      const scoped = filterForAuditPeriod(
        s.history,
        s.unreviewedChanges,
        period,
      );
      const report: AccessReviewReport = {
        title: L.pdfTitle,
        business: (tenant as any)?.name ?? "",
        location: s.site.name,
        meta: [
          [
            L.pdfGenerated,
            now.toLocaleString(
              lang === "en" ? "en-GB" : lang === "fi" ? "fi-FI" : "sv-SE",
            ),
          ],
          [
            L.pdfStatus,
            (s.last
              ? L.lastAccepted.replace("{date}", fmt(s.last.accepted_at)) + ", "
              : L.never + ", ") +
              (s.changed ? L.changed + ", " : "") +
              dueText(s.last?.accepted_at),
          ],
          [L.pdfInterval, L.daysN.replace("{n}", String(interval))],
          [
            L.pdfPeriod,
            hasPeriod
              ? L.pdfPeriodText
                  .replace(
                    "{from}",
                    period.from ? dayText(period.from) : L.pdfStart,
                  )
                  .replace("{to}", period.to ? dayText(period.to) : L.pdfNow)
              : L.pdfAllHistory,
          ],
        ],
        sections: [
          {
            heading: L.pdfCurrent,
            blocks: [
              {
                title: L.signIn,
                lines: s.signIn.length
                  ? s.signIn.map(
                      (p) =>
                        p.name +
                        (p.tag ? ` (${p.tag})` : "") +
                        (p.muted ? `, ${L.notApproved}` : ""),
                    )
                  : [L.none],
              },
              {
                title: L.shiftStaff,
                lines: s.shift.length
                  ? s.shift.map((p) => p.name + (p.tag ? ` (${p.tag})` : ""))
                  : [L.none],
              },
            ],
          },
          {
            heading: L.pdfOpen,
            empty: L.pdfNone,
            blocks: [
              {
                lines: s.requests.map(
                  (q) => `${fmt(q.created_at)}: ${q.subject_name}: ${q.note}`,
                ),
              },
            ],
          },
          {
            heading: L.history,
            empty: hasPeriod ? L.pdfNoneInPeriod : L.never,
            blocks: scoped.history.map((h) => {
              const lines: string[] = [
                h.untilAt
                  ? L.untilNext.replace("{date}", fmt(h.untilAt))
                  : L.untilNow,
              ];
              const diffs: [string, string[]][] = [
                [L.gainedSignIn, h.usersAdded.map(userName)],
                [L.lostSignIn, h.usersRemoved.map(userName)],
                [L.addedShift, h.staffAdded.map(staffName)],
                [L.removedShift, h.staffRemoved.map(staffName)],
              ];
              const shown = diffs.filter(([, n]) => n.length);
              if (shown.length)
                for (const [label, n] of shown)
                  lines.push(`${label}: ${n.join(", ")}`);
              else lines.push(L.noChanges);
              for (const c of h.changes)
                lines.push(`${L.changesLog}: ${describeChange(c)}`);
              for (const q of h.requests)
                lines.push(
                  `${L.handled}: ${q.subject_name}: ${q.note} (${
                    q.status === "done" ? L.reqDone : L.reqDismissed
                  })`,
                );
              return {
                title: L.acceptedBy
                  .replace("{date}", fmt(h.review.accepted_at))
                  .replace("{name}", userName(h.review.accepted_by)),
                lines,
              };
            }),
          },
          ...(scoped.unreviewed.length
            ? [
                {
                  heading: L.notReviewedChanges,
                  blocks: [{ lines: scoped.unreviewed.map(describeChange) }],
                },
              ]
            : []),
        ],
        footer: `${L.pdfFooter}, ${s.site.name}`,
      };
      const { jsPDF } = await import("jspdf");
      renderAccessReviewPdf(jsPDF, report).save(
        accessReviewFileName((tenant as any)?.slug, s.site.name, now, period),
      );
      return true;
    } catch (e) {
      console.error(e);
      toast.error(L.pdfFailed);
      return false;
    }
  };

  const PersonList = ({
    siteId,
    people,
  }: {
    siteId: string;
    people: Person[];
  }) =>
    people.length === 0 ? (
      <p className="text-sm text-muted-foreground">{L.none}</p>
    ) : (
      <ul className="divide-y divide-border">
        {people.map((p) => {
          const open =
            draft?.siteId === siteId &&
            draft.p.id === p.id &&
            draft.p.kind === p.kind;
          return (
            <li key={p.kind + p.id} className="py-1.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={p.muted ? "text-muted-foreground" : ""}>
                  {p.name}
                </span>
                {p.tag && <Badge variant="outline">{p.tag}</Badge>}
                {p.muted && <Badge variant="secondary">{L.notApproved}</Badge>}
                {p.kind === "staff" && (
                  <select
                    aria-label={`${L.worksAt}: ${p.name}`}
                    className="h-7 rounded border border-input bg-background px-1 text-xs"
                    value={
                      (p.siteIds?.length ?? 0) > 1
                        ? "__many"
                        : (p.siteIds?.[0] ?? "")
                    }
                    disabled={moveStaff.isPending}
                    onChange={(e) =>
                      e.target.value !== "__many" &&
                      moveStaff.mutate({
                        id: p.id,
                        siteIds: e.target.value ? [e.target.value] : [],
                      })
                    }
                  >
                    {(p.siteIds?.length ?? 0) > 1 && (
                      <option value="__many" disabled>
                        {L.severalLoc}
                      </option>
                    )}
                    <option value="">{L.allLoc}</option>
                    {(data?.sites ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                )}
                {p.kind === "user" && p.role === "staff" && canEditSignIn && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={setSignIn.isPending}
                    onClick={() =>
                      setSignIn.mutate({ userId: p.id, siteId, on: false })
                    }
                  >
                    {L.removeHere}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-7"
                  onClick={() =>
                    setDraft(open ? null : { siteId, p, note: "" })
                  }
                >
                  {L.request}
                </Button>
              </div>
              {open && (
                <form
                  className="mt-1 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const note = draft.note.trim();
                    if (!note) return;
                    addReq.mutate(
                      { siteId, p, note: note.slice(0, 1000) },
                      { onSuccess: () => setDraft(null) },
                    );
                  }}
                >
                  <Input
                    autoFocus
                    aria-label={L.notePh}
                    placeholder={L.notePh}
                    value={draft.note}
                    maxLength={1000}
                    onChange={(e) =>
                      setDraft({ ...draft, note: e.target.value })
                    }
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={addReq.isPending || !draft.note.trim()}
                  >
                    {L.add}
                  </Button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{L.intro}</p>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        {L.reviewEvery}
        <select
          className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={interval}
          disabled={saveSettings.isPending}
          onChange={(e) =>
            saveSettings.mutate(
              { ...settings, accessReviewDays: Number(e.target.value) },
              { onSuccess: () => toast.success(L.ok) },
            )
          }
        >
          {Array.from(new Set([30, 60, 90, 180, 365, interval]))
            .sort((a, b) => a - b)
            .map((n) => (
              <option key={n} value={n}>
                {L.daysN.replace("{n}", String(n))}
              </option>
            ))}
        </select>
      </label>
      {unassigned.length > 0 && (
        <div className="flex gap-2 rounded-md border border-border bg-muted p-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            {L.unassigned}{" "}
            {unassigned
              .map((u) => u.display_name || u.user_id.slice(0, 8))
              .join(", ")}
          </span>
        </div>
      )}
      {perSite.map((s) => (
        <section
          key={s.site.id}
          id={`access-site-${s.site.id}`}
          tabIndex={-1}
          aria-label={s.site.name}
          className={`space-y-3 rounded-lg border bg-card p-4 outline-none ${
            focus?.siteId === s.site.id
              ? "border-primary ring-2 ring-primary/40"
              : "border-border"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{s.site.name}</h3>
            {s.last ? (
              <Badge variant={s.changed ? "destructive" : "secondary"}>
                {s.changed
                  ? L.changed
                  : L.lastAccepted.replace("{date}", fmt(s.last.accepted_at))}
              </Badge>
            ) : (
              <Badge variant="outline">{L.never}</Badge>
            )}
            {(() => {
              const d = reviewDue(s.last?.accepted_at, interval);
              if (d.state === "ok")
                return (
                  <span className="text-xs text-muted-foreground">
                    {L.dueOn.replace("{date}", fmt(d.dueAt!.toISOString()))}
                  </span>
                );
              return (
                <Badge
                  variant={d.state === "dueSoon" ? "secondary" : "destructive"}
                >
                  {d.state === "overdue"
                    ? L.overdueBy.replace("{days}", String(d.daysOverdue))
                    : d.state === "never"
                      ? L.reviewNeeded
                      : L.dueOn.replace("{date}", fmt(d.dueAt!.toISOString()))}
                </Badge>
              );
            })()}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-1 text-sm font-medium">{L.signIn}</h4>
              <PersonList siteId={s.site.id} people={s.signIn} />
              {canEditSignIn && s.addable.length > 0 && (
                <select
                  aria-label={L.giveAccess}
                  className="mt-2 h-8 w-full rounded border border-input bg-background px-2 text-sm"
                  value=""
                  disabled={setSignIn.isPending}
                  onChange={(e) =>
                    e.target.value &&
                    setSignIn.mutate({
                      userId: e.target.value,
                      siteId: s.site.id,
                      on: true,
                    })
                  }
                >
                  <option value="">{L.giveAccess}</option>
                  {s.addable.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.display_name || u.user_id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <h4 className="mb-1 text-sm font-medium">{L.shiftStaff}</h4>
              <PersonList siteId={s.site.id} people={s.shift} />
            </div>
          </div>
          {s.requests.length > 0 && (
            <div>
              <h4 className="mb-1 text-sm font-medium">{L.openReq}</h4>
              <ul className="space-y-1">
                {s.requests.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-sm"
                  >
                    <span className="font-medium">{r.subject_name}:</span>
                    <span className="min-w-0 flex-1 break-words">{r.note}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      disabled={resolve.isPending}
                      onClick={() =>
                        resolve.mutate({ id: r.id, status: "done" })
                      }
                    >
                      {L.done}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      disabled={resolve.isPending}
                      onClick={() =>
                        resolve.mutate({ id: r.id, status: "dismissed" })
                      }
                    >
                      {L.dismiss}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.unreviewedChanges.length > 0 && (
            <details className="rounded border border-border p-2 text-sm">
              <summary className="cursor-pointer font-medium">
                {L.notReviewedChanges} ({s.unreviewedChanges.length})
              </summary>
              <ul className="mt-2 space-y-0.5">
                {s.unreviewedChanges.map((c) => (
                  <li key={c.id} className="break-words">
                    {describeChange(c)}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {s.history.length > 0 && (
            <details className="rounded border border-border p-2 text-sm">
              <summary className="cursor-pointer font-medium">
                {L.history} ({s.history.length})
              </summary>
              <ol className="mt-2 space-y-3">
                {s.history.map((h) => {
                  const lines: [string, string[]][] = [
                    [L.gainedSignIn, h.usersAdded.map(userName)],
                    [L.lostSignIn, h.usersRemoved.map(userName)],
                    [L.addedShift, h.staffAdded.map(staffName)],
                    [L.removedShift, h.staffRemoved.map(staffName)],
                  ];
                  const any = lines.some(([, n]) => n.length > 0);
                  return (
                    <li
                      key={h.review.id}
                      className="space-y-1 border-l-2 border-border pl-3"
                    >
                      <p className="font-medium">
                        {L.acceptedBy
                          .replace("{date}", fmt(h.review.accepted_at))
                          .replace("{name}", userName(h.review.accepted_by))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {h.untilAt
                          ? L.untilNext.replace("{date}", fmt(h.untilAt))
                          : L.untilNow}
                      </p>
                      {any ? (
                        <ul className="space-y-0.5">
                          {lines
                            .filter(([, n]) => n.length > 0)
                            .map(([label, names]) => (
                              <li key={label}>
                                {label}: {names.join(", ")}
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">{L.noChanges}</p>
                      )}
                      {h.changes.length > 0 && (
                        <div>
                          <p className="text-xs font-medium">{L.changesLog}</p>
                          <ul className="space-y-0.5">
                            {h.changes.map((c) => (
                              <li key={c.id} className="break-words">
                                {describeChange(c)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {h.requests.length > 0 && (
                        <div>
                          <p className="text-xs font-medium">{L.handled}</p>
                          <ul className="space-y-0.5">
                            {h.requests.map((q) => (
                              <li key={q.id} className="break-words">
                                {q.subject_name}: {q.note} (
                                {q.status === "done"
                                  ? L.reqDone
                                  : L.reqDismissed}
                                )
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </details>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={s.requests.length > 0 || accept.isPending}
              onClick={() =>
                accept.mutate({ siteId: s.site.id, snapshot: s.snapshot })
              }
            >
              <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden />
              {L.accept}
            </Button>
            {s.requests.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {L.acceptBlocked}
              </span>
            )}
            <PdfExportButton
              L={L}
              onExport={(period) => exportPdf(s, period)}
            />
          </div>
        </section>
      ))}
    </div>
  );
}

function PdfExportButton({
  L,
  onExport,
}: {
  L: {
    pdf: string;
    pdfPeriod: string;
    pdfFrom: string;
    pdfTo: string;
    pdfPeriodHint: string;
    pdfDownload: string;
  };
  onExport: (period: AuditPeriod) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const uid = useId();
  const download = async () => {
    setBusy(true);
    const ok = await onExport({ from: from || undefined, to: to || undefined });
    setBusy(false);
    if (ok) setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="ml-auto">
          <FileDown className="mr-1 h-4 w-4" aria-hidden />
          {L.pdf}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-sm font-medium">{L.pdfPeriod}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={`${uid}-from`}>{L.pdfFrom}</Label>
            <Input
              id={`${uid}-from`}
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${uid}-to`}>{L.pdfTo}</Label>
            <Input
              id={`${uid}-to`}
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{L.pdfPeriodHint}</p>
        <Button size="sm" className="w-full" disabled={busy} onClick={download}>
          <FileDown className="mr-1 h-4 w-4" aria-hidden />
          {L.pdfDownload}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
