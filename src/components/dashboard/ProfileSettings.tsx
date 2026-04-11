import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Upload, X, User } from "lucide-react";
import TwoFactorSettings from "./TwoFactorSettings";

const ProfileSettings = () => {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id || !tenantId) return null;
      const { data, error } = await supabase
        .from("tenant_users")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!tenantId,
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async (updates: { display_name: string; avatar_url: string | null }) => {
      if (!user?.id || !tenantId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("tenant_users")
        .update(updates)
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated successfully");
    },
    onError: () => toast.error("Failed to update profile"),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id || !tenantId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }

    setUploading(true);
    try {
      const { sanitizeFileExtension, sanitizePathSegment } = await import("@/lib/sanitize-path");
      const ext = sanitizeFileExtension(file.name.split(".").pop());
      const safeTenant = sanitizePathSegment(tenantId!);
      const safeUser = sanitizePathSegment(user.id);
      const path = `${safeTenant}/avatars/${safeUser}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("tenant-assets")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("tenant-assets")
        .getPublicUrl(path);

      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(newUrl);
      await updateProfile.mutateAsync({ display_name: displayName, avatar_url: newUrl });
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
  };

  const handleSave = () => {
    updateProfile.mutate({ display_name: displayName.trim(), avatar_url: avatarUrl });
  };

  const initials = displayName
    ? displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "?";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-lg" data-tour="profile-panel">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Profile Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={avatarUrl || undefined} alt={displayName || "Avatar"} />
                <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove avatar"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="space-y-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-1.5"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Uploading…" : "Upload photo"}
              </Button>
              <p className="text-xs text-muted-foreground">JPG, PNG or WebP. Max 2MB.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              This is how your name appears to other team members.
            </p>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed here.
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateProfile.isPending}
            className="w-full sm:w-auto"
          >
            {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <TwoFactorSettings />
    </div>
  );
};

export default ProfileSettings;
