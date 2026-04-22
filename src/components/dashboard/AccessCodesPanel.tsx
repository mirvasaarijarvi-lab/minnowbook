import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Ticket, Plus, Copy, Ban, Trash2, Users, Calendar, Clock, Shield, Mail,
} from "lucide-react";
import BetaInviteEmailPreview from "./BetaInviteEmailPreview";

interface AccessCode {
  id: string;
  code_prefix: string;
  description: string | null;
  tier: string;
  duration_days: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  is_revoked: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_by: string;
  created_at: string;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BETA-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const AccessCodesPanel = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  // After successful creation, plaintext is shown ONCE for the superadmin to copy/share.
  // It is never stored in the DB (only the SHA-256 hash is).
  const [lastCreatedPlaintext, setLastCreatedPlaintext] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: generateCode(),
    description: "",
    tier: "business",
    duration_days: 30,
    valid_from: "",
    valid_until: "",
    max_uses: "",
  });

  const { data: codes, isLoading } = useQuery({
    queryKey: ["access-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_codes")
        .select("id, code_prefix, description, tier, duration_days, valid_from, valid_until, max_uses, used_count, is_active, is_revoked, revoked_at, revoked_reason, created_by, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AccessCode[];
    },
  });

  const { data: redemptions } = useQuery({
    queryKey: ["access-code-redemptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_code_redemptions")
        .select("*, tenants(name, slug)")
        .order("redeemed_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const plaintext = form.code.trim().toUpperCase();
      const { error } = await supabase.rpc("create_access_code", {
        p_code: plaintext,
        p_description: form.description || null,
        p_tier: form.tier,
        p_duration_days: form.duration_days,
        p_valid_from: form.valid_from || null,
        p_valid_until: form.valid_until || null,
        p_max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      });
      if (error) throw error;
      return plaintext;
    },
    onSuccess: (plaintext) => {
      queryClient.invalidateQueries({ queryKey: ["access-codes"] });
      setCreateOpen(false);
      setLastCreatedPlaintext(plaintext);
      setForm({ ...form, code: generateCode(), description: "", max_uses: "" });
      toast({ title: "Access code created", description: "Copy it now — only the hash is stored." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (!revokeId) return;
      const { error } = await supabase
        .from("access_codes")
        .update({
          is_revoked: true,
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_reason: revokeReason || null,
        })
        .eq("id", revokeId);
      if (error) throw error;

      // Deactivate all active redemptions for this code
      await supabase
        .from("access_code_redemptions")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("access_code_id", revokeId)
        .eq("is_active", true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-codes"] });
      queryClient.invalidateQueries({ queryKey: ["access-code-redemptions"] });
      setRevokeId(null);
      setRevokeReason("");
      toast({ title: "Access code revoked" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("access_codes")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-codes"] });
      toast({ title: "Access code updated" });
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied", description: `Code ${code} copied to clipboard` });
  };

  const getCodeRedemptions = (codeId: string) =>
    (redemptions ?? []).filter((r: any) => r.access_code_id === codeId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-accent" />
            <CardTitle className="text-xl font-serif">Beta Access Codes</CardTitle>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Create Code
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-4 border-accent border-t-transparent rounded-full" />
            </div>
          ) : (codes ?? []).length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No access codes yet. Create one to invite beta testers.</p>
          ) : (
            <div className="space-y-3">
              {(codes ?? []).map((ac) => {
                const codeRedemptions = getCodeRedemptions(ac.id);
                return (
                  <div key={ac.id} className="p-4 rounded-lg border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-sm font-bold text-foreground flex items-center gap-1"
                          title="Only the prefix is shown — the full code is hashed and cannot be retrieved"
                        >
                          {ac.code_prefix}…
                        </span>
                        <Badge variant={ac.is_revoked ? "destructive" : ac.is_active ? "default" : "secondary"} className="text-[10px]">
                          {ac.is_revoked ? "Revoked" : ac.is_active ? "Active" : "Paused"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{ac.tier}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {!ac.is_revoked && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActiveMutation.mutate({ id: ac.id, is_active: !ac.is_active })}
                              className="text-xs h-7"
                            >
                              {ac.is_active ? "Pause" : "Activate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRevokeId(ac.id)}
                              className="text-xs h-7 text-destructive hover:text-destructive"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {ac.description && (
                      <p className="text-sm text-muted-foreground">{ac.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {ac.duration_days} days
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {ac.used_count}{ac.max_uses !== null ? `/${ac.max_uses}` : ""} used
                      </span>
                      {ac.valid_from && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> From: {ac.valid_from}
                        </span>
                      )}
                      {ac.valid_until && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Until: {ac.valid_until}
                        </span>
                      )}
                      {ac.revoked_reason && (
                        <span className="text-destructive">Reason: {ac.revoked_reason}</span>
                      )}
                    </div>
                    {codeRedemptions.length > 0 && (
                      <div className="pt-1 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Redemptions:</p>
                        {codeRedemptions.map((r: any) => (
                          <div key={r.id} className="text-xs text-muted-foreground flex items-center gap-2 pl-2">
                            <span className="font-medium text-foreground">{r.tenants?.name ?? "Unknown"}</span>
                            <span>to {r.granted_tier} until {r.granted_until}</span>
                            {!r.is_active && <Badge variant="destructive" className="text-[9px] h-4">Revoked</Badge>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <BetaInviteEmailPreview />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Ticket className="h-5 w-5 text-accent" />
              Create Access Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Code</Label>
              <div className="flex gap-2">
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
                <Button variant="outline" size="sm" onClick={() => setForm({ ...form, code: generateCode() })}>
                  Regenerate
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="e.g. Beta tester group A"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tier Granted</Label>
                <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={form.duration_days}
                  onChange={(e) => setForm({ ...form, duration_days: parseInt(e.target.value) || 30 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Valid From (optional)</Label>
                <Input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Valid Until (optional)</Label>
                <Input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Max Uses (leave empty for unlimited)</Label>
              <Input
                type="number"
                min={1}
                placeholder="Unlimited"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              />
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.code.trim()}>
              {createMutation.isPending ? "Creating..." : "Create Access Code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke dialog */}
      <Dialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-destructive flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Revoke Access Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              This will permanently deactivate the code and revoke access for all tenants who redeemed it.
            </p>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="Why is this code being revoked?"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRevokeId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => revokeMutation.mutate()} disabled={revokeMutation.isPending}>
                {revokeMutation.isPending ? "Revoking..." : "Revoke"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccessCodesPanel;
