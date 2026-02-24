import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, User, Mail, Phone } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const ReservationList = () => {
  const { tenantId } = useTenant();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations", tenantId, statusFilter, typeFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("reservations")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("date", { ascending: false });

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (typeFilter !== "all") query = query.eq("reservation_type", typeFilter);

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-bold text-foreground">Reservations</h2>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="restaurant">Restaurant</SelectItem>
              <SelectItem value="venue">Venue</SelectItem>
              <SelectItem value="guesthouse">Guesthouse</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-20" />
            </Card>
          ))}
        </div>
      ) : !reservations?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No reservations found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reservations.map((r) => (
            <Card key={r.id} className="hover:shadow-hover transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">{r.guest_name}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {r.reservation_type}
                      </Badge>
                      <Badge className={`text-xs ${statusColors[r.status ?? "pending"] ?? ""}`}>
                        {r.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {format(new Date(r.date), "PPP")}
                        {r.start_time && ` at ${r.start_time.slice(0, 5)}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {r.guest_email}
                      </span>
                      {r.guest_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {r.guest_phone}
                        </span>
                      )}
                      {r.guests_count && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {r.guests_count} guests
                        </span>
                      )}
                    </div>
                  </div>
                  {r.price_eur != null && (
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                      €{Number(r.price_eur).toFixed(2)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReservationList;
