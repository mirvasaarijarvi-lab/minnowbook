import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Upload, X, Loader2 } from "lucide-react";

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

  return (
    <div className="space-y-2">
      <Label>{t("dashboard.gallery")}</Label>

      {/* Thumbnails grid */}
      <div className="flex flex-wrap gap-2">
        {images.map((img: any) => (
          <div key={img.id} className="relative group">
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
