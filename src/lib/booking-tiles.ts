/**
 * Pure helpers extracted from PublicBooking for unit testing.
 *
 * `buildTypeTiles` renders one tile per built-in reservation type (skipping
 * the bare "custom" type) and ONE TILE PER custom resource, keyed by
 * `custom:<resource_id>` and labelled with `custom_type_label` (falling back
 * to the resource name, then "Custom").
 */

export type CustomSubService = { id: string; name: string; price_eur?: number };

export type SiteResource = {
  id: string;
  resource_type: string;
  name?: string | null;
  custom_type_label?: string | null;
  sub_services?: unknown;
};

export type TypeTile =
  | { kind: "builtin"; key: string; type: string }
  | {
      kind: "custom";
      key: string;
      resourceId: string;
      label: string;
      subServices: CustomSubService[];
    };

export function buildTypeTiles(
  allowedTypes: string[],
  allSiteResources: SiteResource[] | null | undefined,
): TypeTile[] {
  const tiles: TypeTile[] = [];

  for (const type of allowedTypes) {
    if (type === "custom") continue;
    tiles.push({ kind: "builtin", key: type, type });
  }

  if (allowedTypes.includes("custom") && allSiteResources) {
    const customResources = allSiteResources.filter(
      (r) => r.resource_type === "custom",
    );
    for (const r of customResources) {
      tiles.push({
        kind: "custom",
        key: `custom:${r.id}`,
        resourceId: r.id,
        label: r.custom_type_label || r.name || "Custom",
        subServices: Array.isArray(r.sub_services)
          ? (r.sub_services as CustomSubService[])
          : [],
      });
    }
  }

  return tiles;
}

/**
 * Mirrors the booking form state transition when a user clicks a tile.
 * Returns the new partial form patch to apply.
 */
export function selectTile(tile: TypeTile): {
  reservation_type: string;
  resource_id: string;
  selected_sub_services: CustomSubService[];
} {
  if (tile.kind === "builtin") {
    return { reservation_type: tile.type, resource_id: "", selected_sub_services: [] };
  }
  return {
    reservation_type: "custom",
    resource_id: tile.resourceId,
    selected_sub_services: [],
  };
}
