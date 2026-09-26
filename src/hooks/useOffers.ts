import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export interface LinkedReservation {
  enabled: boolean;
  resource_type?: string;
  space?: string;
  menu?: string;
  special_requests?: string;
  guests_count?: number;
  start_time?: string;
  end_time?: string;
}

export interface Offer {
  id: string;
  tenant_id: string;
  status: "draft" | "sent" | "confirmed" | "declined" | "expired";
  /** Last valid day (yyyy-MM-dd). Open offers after it count as expired. */
  expires_on?: string | null;
  declined_at?: string | null;
  accepted_at?: string | null;
  guest_accepted_at?: string | null;
  guest_accept_note?: string | null;
  validity_date: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  guests_count: number;
  event_space: string;
  event_type: string | null;
  invoicing_details: string | null;
  special_requests: string | null;
  menu: string | null;
  linked_reservations: Record<string, LinkedReservation> | null;
  reservation_ids: string[] | null;
  created_by: string | null;
  language: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  last_sent_at: string | null;
  last_send_provider_id: string | null;
  /** Public booking this offer was made from, if any. */
  source_reservation_id?: string | null;
  /** Audit (write-once, set by the database): who confirmed and when. */
  confirmed_by?: string | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  confirmed_reservation_id?: string | null;
  reservation_created_at?: string | null;
}

export const useOffers = (showArchived = false) => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  // Live updates: when another staff member confirms an offer, this list
  // refreshes so their Confirm button is disabled straight away.
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`offers-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "offers",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["offers", tenantId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  return useQuery({
    queryKey: ["offers", tenantId, showArchived],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("offers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (!showArchived) {
        query = query.is("archived_at", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Offer[];
    },
    enabled: !!tenantId,
    // Fallback if the live connection drops.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
};

export const useCreateOffer = () => {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (
      offer: Omit<
        Offer,
        | "id"
        | "tenant_id"
        | "created_at"
        | "updated_at"
        | "reservation_ids"
        | "archived_at"
        | "last_sent_at"
        | "last_send_provider_id"
      >,
    ) => {
      if (!tenantId) throw new Error("No tenant");
      const { data, error } = await supabase
        .from("offers")
        .insert({ ...offer, tenant_id: tenantId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Offer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
  });
};

export const useUpdateOffer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Offer> & { id: string }) => {
      const { data, error } = await supabase
        .from("offers")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Offer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
  });
};
