import { createContext, useContext } from "react";

export interface SiteContextValue {
  selectedSiteId: string | null;
  setSelectedSiteId: (id: string | null) => void;
  selectedResourceId: string | null;
  setSelectedResourceId: (id: string | null) => void;
}

export const SiteContext = createContext<SiteContextValue>({
  selectedSiteId: null,
  setSelectedSiteId: () => {},
  selectedResourceId: null,
  setSelectedResourceId: () => {},
});

export const useSiteContext = () => useContext(SiteContext);
