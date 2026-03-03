import { createContext, useContext } from "react";

export interface SiteContextValue {
  selectedSiteId: string | null;
  setSelectedSiteId: (id: string | null) => void;
}

export const SiteContext = createContext<SiteContextValue>({
  selectedSiteId: null,
  setSelectedSiteId: () => {},
});

export const useSiteContext = () => useContext(SiteContext);
