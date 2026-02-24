import { useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/contexts/I18nContext";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Upload, X, Loader2, GripVertical } from "lucide-react";

const MAX_IMAGES = 5;
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

interface Props {
  resourceId: string;
  tenantId: string;
}

const ResourceImageGallery = ({ resourceId, tenantId }: Props) => {
  const t = useT();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const { data: images = [], isLoading } = useQuery({
    queryKey: ["resource-images", resourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_images")
        .select("*")
        .eq("resource_id", resourceId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!resourceId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop();
      const fileName = `gallery-${Date.now()}.${ext}`;
      const filePath = `${tenantId}/resources/${resourceId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("tenant-assets")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("tenant-assets")
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: insertError } = await supabase
        .from("resource_images")
        .insert({
          resource_id: resourceId,
          tenant_id: tenantId,
          image_url: publicUrl,
          sort_order: images.length,
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-images", resourceId] });
      toast({ title: t("dashboard.imageUploaded") });
    },
    onError: () => {
      toast({ title: t("dashboard.imageUploadError"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const { error } = await supabase
        .from("resource_images")
        .delete()
        .eq("id", imageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-images", resourceId] });
      toast({ title: t("dashboard.imageDeleted") });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (reordered: { id: string; sort_order: number }[]) => {
      // Update each image's sort_order
      const updates = reordered.map((item) =>
        supabase
          .from("resource_images")
          .update({ sort_order: item.sort_order })
          .eq("id", item.id)
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-images", resourceId] });
    },
    onError: () => {
      toast({ title: t("settings.saveError"), variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["resource-images", resourceId] });
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED.includes(file.type)) {
      toast({ title: "Error", description: "Use PNG, JPG or WebP.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: "Error", description: "Max 5 MB.", variant: "destructive" });
      return;
    }
    if (images.length >= MAX_IMAGES) {
      toast({ title: t("dashboard.maxImages"), variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  /* ── Drag & Drop handlers ── */
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const reordered = [...images];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(overIndex, 0, moved);

      const updates = reordered.map((img: any, i: number) => ({
        id: img.id,
        sort_order: i,
      }));

      // Optimistic update via cache
      queryClient.setQueryData(["resource-images", resourceId], reordered.map((img: any, i: number) => ({ ...img, sort_order: i })));
      reorderMutation.mutate(updates);
    }
    setDragIndex(null);
    setOverIndex(null);
  }, [dragIndex, overIndex, images, queryClient, resourceId, reorderMutation]);

  return (
    <div className="space-y-2">
      <Label>{t("dashboard.gallery")}</Label>

      {/* Thumbnails grid with drag-and-drop */}
      <div className="flex flex-wrap gap-2">
        {images.map((img: any, index: number) => (
          <div
            key={img.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`relative group cursor-grab active:cursor-grabbing transition-all ${
              dragIndex === index ? "opacity-40 scale-95" : ""
            } ${overIndex === index && dragIndex !== index ? "ring-2 ring-accent ring-offset-1 rounded-lg" : ""}`}
          >
            <div className="absolute top-0.5 left-0.5 z-10 h-5 w-5 rounded bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <GripVertical className="h-3 w-3" />
            </div>
            <img
              src={img.image_url}
              alt=""
              className="h-20 w-20 rounded-lg object-cover border border-border"
            />
            <button
              type="button"
              onClick={() => deleteMutation.mutate(img.id)}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Add button */}
        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("dashboard.galleryHint")} ({images.length}/{MAX_IMAGES})
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
};

export default ResourceImageGallery;
