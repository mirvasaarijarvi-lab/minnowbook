/**
 * The permission empty state must report itself to analytics exactly once
 * per blocked surface, must never break rendering if analytics fails, and
 * must let a blocked user send an access request to owners/admins.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PermissionEmptyState from "./PermissionEmptyState";

const permissionEmptyStateShown = vi.fn();
vi.mock("@/lib/gtm", () => ({
  gtm: {
    permissionEmptyStateShown: (...args: unknown[]) =>
      permissionEmptyStateShown(...args),
  },
}));

const insert = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: (payload: unknown) => insert(payload) }) },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));

vi.mock("@/contexts/I18nContext", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("PermissionEmptyState", () => {
  beforeEach(() => {
    permissionEmptyStateShown.mockReset();
    permissionEmptyStateShown.mockImplementation(() => undefined);
    insert.mockReset();
    insert.mockResolvedValue({ error: null });
  });

  it("reports the blocked surface once with tenant and site context", () => {
    const { rerender } = render(
      <PermissionEmptyState
        surface="settings_site"
        tenantId="tenant-1"
        siteId="site-1"
        title="No access"
        description="Ask an owner"
        detail="permission denied"
      />
    );

    expect(permissionEmptyStateShown).toHaveBeenCalledTimes(1);
    expect(permissionEmptyStateShown).toHaveBeenCalledWith({
      surface: "settings_site",
      reason: "permission denied",
      tenant_id: "tenant-1",
      site_id: "site-1",
    });

    // A changing server message must not re-fire for the same surface.
    rerender(
      <PermissionEmptyState
        surface="settings_site"
        tenantId="tenant-1"
        siteId="site-1"
        title="No access"
        description="Ask an owner"
        detail="permission denied (retry)"
      />
    );
    expect(permissionEmptyStateShown).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when no surface is given", () => {
    render(<PermissionEmptyState title="No access" description="Ask an owner" />);
    expect(permissionEmptyStateShown).not.toHaveBeenCalled();
  });

  it("still renders if analytics throws", () => {
    permissionEmptyStateShown.mockImplementation(() => {
      throw new Error("gtm down");
    });
    render(
      <PermissionEmptyState
        surface="settings_panel"
        title="No access"
        description="Ask an owner"
      />
    );
    expect(screen.getByText("No access")).toBeInTheDocument();
  });

  it("hides the access-request CTA unless enabled with a tenant", () => {
    render(
      <PermissionEmptyState
        surface="settings_panel"
        title="No access"
        description="Ask an owner"
      />
    );
    expect(screen.queryByRole("button", { name: "access.requestButton" })).toBeNull();
  });

  it("sends an access request and confirms it inline", async () => {
    const user = userEvent.setup();
    render(
      <PermissionEmptyState
        surface="settings_site"
        tenantId="tenant-1"
        siteId="site-1"
        allowAccessRequest
        title="No access"
        description="Ask an owner"
      />
    );

    await user.click(screen.getByRole("button", { name: /access.requestButton/ }));
    await user.type(screen.getByRole("textbox"), "I need the branding settings");
    await user.click(screen.getByRole("button", { name: "access.requestSubmit" }));

    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    const payload = insert.mock.calls[0][0] as Record<string, string>;
    expect(payload.tenant_id).toBe("tenant-1");
    expect(payload.user_id).toBe("user-1");
    expect(payload.subject).toContain("access.requestSubject");
    expect(payload.message).toContain("I need the branding settings");

    expect(await screen.findByText("access.requestSentInline")).toBeInTheDocument();
  });
});
