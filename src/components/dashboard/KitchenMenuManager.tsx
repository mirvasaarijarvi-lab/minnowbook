import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, UtensilsCrossed, Wine, Package } from "lucide-react";
import { toast } from "sonner";

type Category = "food" | "drink" | "other";

export interface MenuItem {
  id: string;
  tenant_id: string;
  name: string;
  category: Category;
  unit_price_eur: number | null;
  sort_order: number;
  is_active: boolean;
}

const CATEGORY_ICON: Record<Category, React.ElementType> = {
  food: UtensilsCrossed,
  drink: Wine,
  other: Package,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KitchenMenuManager = ({ open, onOpenChange }: Props) => {
  const t = useT();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const [draftName, setDraftName] = useState("");
  const [draftCategory, setDraftCategory] = useState<Category>("food");
  const [draftPrice, setDraftPrice] = useState<string>("");

  const { data: items = [] } = useQuery({
    queryKey: ["kitchen-menu-items", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kitchen_menu_items")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["kitchen-menu-items"] });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!draftName.trim()) return;
      const { error } = await supabase.from("kitchen_menu_items").insert({
        tenant_id: tenantId!,
        name: draftName.trim(),
        category: draftCategory,
        unit_price_eur: draftPrice === "" ? null : parseFloat(draftPrice),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setDraftName("");
      setDraftPrice("");
      toast.success(t("kitchen.menu.saved"));
    },
    onError: () => toast.error(t("kitchen.menu.saveError")),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<MenuItem> }) => {
      const { error } = await supabase
        .from("kitchen_menu_items")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error(t("kitchen.menu.saveError")),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kitchen_menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("kitchen.menu.deleted"));
    },
    onError: () => toast.error(t("kitchen.menu.saveError")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("kitchen.menu.title")}</DialogTitle>
          <DialogDescription>{t("kitchen.menu.empty")}</DialogDescription>
        </DialogHeader>

        {/* Add new item */}
        <div className="grid grid-cols-12 gap-2 p-3 rounded-md border border-border bg-muted/30">
          <div className="col-span-12 sm:col-span-6">
            <Input
              value={draftName}
              placeholder={t("kitchen.menu.namePlaceholder")}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draftName.trim()) addItem.mutate();
              }}
              className="h-9"
            />
          </div>
          <div className="col-span-6 sm:col-span-3">
            <Select value={draftCategory} onValueChange={(v) => setDraftCategory(v as Category)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="food">{t("kitchen.cat.food")}</SelectItem>
                <SelectItem value="drink">{t("kitchen.cat.drink")}</SelectItem>
                <SelectItem value="other">{t("kitchen.cat.other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-4 sm:col-span-2">
            <Input
              type="number"
              step="0.01"
              min={0}
              value={draftPrice}
              placeholder="€"
              onChange={(e) => setDraftPrice(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Button
              size="icon"
              className="h-9 w-9"
              onClick={() => addItem.mutate()}
              disabled={!draftName.trim() || addItem.isPending}
              aria-label={t("kitchen.menu.newItem")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* List existing */}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            {t("kitchen.menu.empty")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => {
              const Icon = CATEGORY_ICON[item.category];
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-2 items-center p-2 rounded-md border border-border"
                >
                  <div className="col-span-12 sm:col-span-6 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      defaultValue={item.name}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next && next !== item.name) {
                          updateItem.mutate({ id: item.id, patch: { name: next } });
                        }
                      }}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <Select
                      value={item.category}
                      onValueChange={(v) =>
                        updateItem.mutate({
                          id: item.id,
                          patch: { category: v as Category },
                        })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="food">{t("kitchen.cat.food")}</SelectItem>
                        <SelectItem value="drink">{t("kitchen.cat.drink")}</SelectItem>
                        <SelectItem value="other">{t("kitchen.cat.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={item.unit_price_eur ?? ""}
                      placeholder="€"
                      onBlur={(e) => {
                        const v = e.target.value === "" ? null : parseFloat(e.target.value);
                        if (v !== item.unit_price_eur) {
                          updateItem.mutate({ id: item.id, patch: { unit_price_eur: v } });
                        }
                      }}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteItem.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("kitchen.menu.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KitchenMenuManager;
