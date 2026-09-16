/**
 * The permission empty state must report itself to analytics exactly once
 * per blocked surface, and must never break rendering if analytics fails.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PermissionEmptyState from "./PermissionEmptyState";

const permissionEmptyStateShown = vi.fn();
vi.mock("@/lib/gtm", () => ({
  gtm: {
    permissionEmptyStateShown: (...args: unknown[]) =>
      permissionEmptyStateShown(...args),
  },
}));

describe("PermissionEmptyState analytics", () => {
  beforeEach(() => {
    permissionEmptyStateShown.mockReset();
    permissionEmptyStateShown.mockImplementation(() => undefined);
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
});
