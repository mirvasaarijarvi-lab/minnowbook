/**
 * Invoice export contract for a discounted reservation.
 *
 * Opens the reservation detail dialog for a booking that used a promo code,
 * clicks "Download invoice", captures the generated PDF blob and asserts the
 * document shows the pre-discount amount, the applied code and the correct
 * final total.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import zlib from "node:zlib";

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenantId: "tenant-1",
    tenant: { id: "tenant-1", name: "Villa Mimmi" },
  }),
}));

vi.mock("@/contexts/I18nContext", () => ({
  useT: () => (key: string) => key,
  useTDynamic: () => (value: string) => value,
  useI18n: () => ({ language: "en" }),
  useLanguage: () => ({ language: "en", setLanguage: vi.fn() }),
}));

vi.mock("@/hooks/useDateLocale", () => ({ useDateLocale: () => undefined }));
vi.mock("@/hooks/useResourceTypeLabel", () => ({
  useResourceTypeLabel: () => ({ typeLabel: (v: string) => v }),
}));
vi.mock("./LinkedReservationsPanel", () => ({ default: () => null }));
vi.mock("./ReservationEmailTimeline", () => ({ default: () => null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              logo_url: null,
              business_name: "Villa Mimmi",
              business_email: "billing@villamimmi.test",
              business_phone: null,
              business_address: null,
              primary_color: null,
            },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

import ReservationDetailDialog from "./ReservationDetailDialog";

/** Inflate PDF streams and decode pdf-lib's hex-encoded `Tj` strings. */
function extractPdfText(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  const raw = buf.toString("latin1");
  let content = "";
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) continue;
    const slice = buf.subarray(start, end);
    try {
      content += zlib.inflateSync(slice).toString("latin1");
    } catch {
      content += slice.toString("latin1");
    }
  }
  return content.replace(/<([0-9A-Fa-f\s]+)>\s*Tj/g, (_all, hex: string) =>
    Buffer.from(hex.replace(/\s+/g, ""), "hex").toString("utf8"),
  );
}

/** jsdom Blob has no arrayBuffer(); read it through FileReader. */
function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

const reservation = {
  id: "3f1c9a44-1111-2222-3333-444455556666",
  guest_name: "Promo Guest",
  guest_email: "promo@example.com",
  guest_phone: "+358401234567",
  guests_count: 2,
  date: "2026-10-01",
  check_out_date: "2026-10-03",
  reservation_type: "accommodation",
  status: "confirmed",
  price_eur: 90,
  original_price_eur: 120,
  discount_type: "percentage",
  discount_value: 25,
  discount_reason: "Promo code: SUMMER25",
  is_invoiced: true,
  created_at: "2026-09-01T10:00:00Z",
};

let capturedBlob: Blob | null = null;
let originalCreate: typeof URL.createObjectURL;
let originalRevoke: typeof URL.revokeObjectURL;
let originalClick: typeof HTMLAnchorElement.prototype.click;

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ReservationDetailDialog
        reservation={reservation}
        open
        onOpenChange={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe("ReservationDetailDialog invoice export", () => {
  beforeEach(() => {
    capturedBlob = null;
    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    originalClick = HTMLAnchorElement.prototype.click;

    // Capture the blob handed to the download anchor.
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:mock";
    }) as any;
    URL.revokeObjectURL = vi.fn() as any;
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
    vi.restoreAllMocks();
    cleanup();
  });

  it("generates an invoice PDF showing the discount code, discounted price and final total", async () => {
    renderDialog();

    const button = await screen.findByTestId("download-invoice");
    expect(button).toHaveTextContent("dashboard.downloadInvoice");

    await userEvent.click(button);

    await waitFor(() => expect(capturedBlob).toBeTruthy(), { timeout: 15000 });
    expect(capturedBlob!.type).toBe("application/pdf");
    const text = extractPdfText(await blobBytes(capturedBlob!));
    expect(text).toContain("Invoice");
    expect(text).toContain("Villa Mimmi");
    expect(text).toContain("Promo Guest");
    // Pre-discount amount
    expect(text).toContain("120.00 EUR");
    // Applied code and rate
    expect(text).toContain("SUMMER25");
    expect(text).toContain("-25%");
    // Discount deduction and correct final total
    expect(text).toContain("-30.00 EUR");
    expect(text).toContain("Total");
    expect(text).toContain("90.00 EUR");

    // The file offered to the user is a PDF download
    await waitFor(() =>
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled(),
    );
  });

  it("hides the invoice action when the reservation has no price", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ReservationDetailDialog
          reservation={{
            ...reservation,
            price_eur: null,
            discount_type: null,
            discount_value: null,
          }}
          open
          onOpenChange={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByTestId("download-invoice")).toBeNull();
  });
});
