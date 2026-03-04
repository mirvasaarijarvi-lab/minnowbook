import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Tag, TicketPercent } from "lucide-react";

interface CodeForm {
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  min_price_eur: number | null;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

const EMPTY_FORM: CodeForm = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: 0,
  max_uses: null,
  min_price_eur: null,
  valid_from: "",
  valid_until: "",
  is_active: true,
};

const DiscountCodesPanel = () => {
  const t = useT();
  const { tenantId, isOwner } = useTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CodeForm>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: codes, isLoading } = useQuery({
    queryKey: ["discount-codes", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        max_uses: form.max_uses || null,
        min_price_eur: form.min_price_eur || null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        is_active: form.is_active,
        tenant_id: tenantId!,
      };
      if (editingId) {
        const { error } = await supabase.from("discount_codes").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("discount_codes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-codes", tenantId] });
      toast.success(editingId ? t("discountCodes.updated") : t("discountCodes.created"));
      closeDialog();
    },
    onError: () => toast.error(t("discountCodes.saveError")),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("discount_codes").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["discount-codes", tenantId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discount_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-codes", tenantId] });
      toast.success(t("discountCodes.deleted"));
      setDeleteId(null);
    },
    onError: () => toast.error(t("discountCodes.deleteError")),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (code: any) => {
    setEditingId(code.id);
    setForm({
      code: code.code,
      description: code.description || "",
      discount_type: code.discount_type,
      discount_value: code.discount_value,
      max_uses: code.max_uses,
      min_price_eur: code.min_price_eur,
      valid_from: code.valid_from || "",
      valid_until: code.valid_until || "",
      is_active: code.is_active,
    });
    setDialogOpen(true);
  };

  if (!isOwner) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <TicketPercent className="h-5 w-5" />
            {t("discountCodes.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t("discountCodes.description")}</p>
        </div>
        <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> {t("discountCodes.add")}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !codes?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>{t("discountCodes.empty")}</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>{t("discountCodes.code")}</TableHead>
                   <TableHead>{t("discountCodes.discountCol")}</TableHead>
                   <TableHead>{t("discountCodes.uses")}</TableHead>
                   <TableHead>{t("discountCodes.validity")}</TableHead>
                   <TableHead>{t("common.status")}</TableHead>
                   <TableHead className="text-right">{t("discountCodes.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                    <TableCell>
                      {c.discount_type === "percentage"
                        ? `${c.discount_value}%`
                        : `€${c.discount_value}`}
                    </TableCell>
                    <TableCell>
                      {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.valid_from && c.valid_until
                        ? `${c.valid_from} – ${c.valid_until}`
                        : c.valid_from
                        ? `${t("discountCodes.from")} ${c.valid_from}`
                        : c.valid_until
                        ? `${t("discountCodes.until")} ${c.valid_until}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={c.is_active}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, active: v })}
                        />
                        <Badge variant={c.is_active ? "default" : "secondary"}>
                          {c.is_active ? t("discountCodes.active") : t("discountCodes.inactive")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? t("discountCodes.editTitle") : t("discountCodes.addTitle")}</DialogTitle>
            <DialogDescription>{t("discountCodes.formDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("discountCodes.code")}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="SUMMER2026"
                className="font-mono uppercase"
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("common.description")}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                maxLength={200}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("discountCodes.discountType")}</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm((f) => ({ ...f, discount_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">{t("discount.percentage")}</SelectItem>
                    <SelectItem value="fixed">{t("discount.fixed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("discountCodes.value")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.discount_value}
                  onChange={(e) => setForm((f) => ({ ...f, discount_value: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("discountCodes.maxUses")}</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder={t("discountCodes.unlimited")}
                  value={form.max_uses ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value ? parseInt(e.target.value) : null }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("discountCodes.minPrice")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="—"
                  value={form.min_price_eur ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, min_price_eur: e.target.value ? parseFloat(e.target.value) : null }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("discountCodes.validFrom")}</Label>
                <Input type="date" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("discountCodes.validUntil")}</Label>
                <Input type="date" value={form.valid_until} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Label>{t("discountCodes.activeLabel")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.code.trim() || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? t("common.update") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("discountCodes.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("discountCodes.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default DiscountCodesPanel;
