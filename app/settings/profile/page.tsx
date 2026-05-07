"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { parseSocialLinks, detectPlatform, PLATFORMS } from "@/lib/utils/social";
import type { SocialLink } from "@/lib/utils/social";

export default function EditProfilePage() {
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Social links state
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkPlatform, setNewLinkPlatform] = useState("website");

  const [form, setForm] = useState({
    display_name: "",
    username: "",
    bio: "",
    tagline: "",
    role: "",
    education: "",
    location: "",
    languages: "",
    avatar_url: "",
    cover_url: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || "",
        username: profile.username || "",
        bio: profile.bio || "",
        tagline: profile.tagline || "",
        role: profile.role || "",
        education: profile.education || "",
        location: profile.location || "",
        languages: profile.languages || "",
        avatar_url: profile.avatar_url || "",
        cover_url: profile.cover_url || "",
      });
      // Parse social links from website field
      setSocialLinks(parseSocialLinks(profile.website));
    }
  }, [profile]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError(null);
    setSuccess(false);
  };

  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  const handleImageUpload = async (
    file: File,
    type: "avatar" | "cover"
  ) => {
    if (!user) return;

    const setUploading = type === "avatar" ? setAvatarUploading : setCoverUploading;
    setUploading(true);
    setError(null);

    try {
      if (file.size > MAX_IMAGE_SIZE) {
        setError("Image must be smaller than 5MB");
        setUploading(false);
        return;
      }

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setError("Only JPEG, PNG, GIF, and WebP images are allowed");
        setUploading(false);
        return;
      }
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const bucketName = type === "avatar" ? "avatars" : "covers";

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, { upsert: true, cacheControl: '31536000' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      setForm((prev) => ({
        ...prev,
        [type === "avatar" ? "avatar_url" : "cover_url"]: publicUrl,
      }));
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Add a new social link
  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;

    const platform = detectPlatform(newLinkUrl) !== "website"
      ? detectPlatform(newLinkUrl)
      : newLinkPlatform;

    setSocialLinks([...socialLinks, { platform, url: newLinkUrl.trim() }]);
    setNewLinkUrl("");
    setNewLinkPlatform("website");
    setError(null);
    setSuccess(false);
  };

  // Remove a social link
  const handleRemoveLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
    setError(null);
    setSuccess(false);
  };

  // Update platform for a link
  const handleUpdatePlatform = (index: number, platform: string) => {
    const updated = [...socialLinks];
    updated[index].platform = platform;
    setSocialLinks(updated);
  };

  function isValidUrl(url: string): boolean {
    if (!url.trim()) return true; // Empty is valid (optional)
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate social link URLs
      const invalidLinks = socialLinks.filter(link => link.url && !isValidUrl(link.url));
      if (invalidLinks.length > 0) {
        setError("Please enter valid URLs for social links (must start with http:// or https://)");
        setSaving(false);
        return;
      }

      // Store social links as JSON string in website field
      const websiteValue = socialLinks.length > 0
        ? JSON.stringify(socialLinks)
        : null;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: form.display_name || null,
          bio: form.bio || null,
          tagline: form.tagline || null,
          role: form.role || null,
          education: form.education || null,
          location: form.location || null,
          languages: form.languages || null,
          website: websiteValue,
          avatar_url: form.avatar_url || null,
          cover_url: form.cover_url || null,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Update error:", err);
      setError("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="font-display text-2xl text-ink mb-2">Edit Profile</h2>
        <p className="font-body text-muted">
          Update your profile information visible to other users
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Cover Photo */}
        <div>
          <label className="block font-ui text-sm text-ink mb-3">
            Cover Photo
          </label>
          <div
            className="relative h-40 rounded-xl bg-gradient-to-r from-purple-primary/20 to-pink-vivid/20 overflow-hidden cursor-pointer group"
            onClick={() => coverInputRef.current?.click()}
          >
            {form.cover_url && (
              <img
                src={form.cover_url}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {coverUploading ? (
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="text-white font-ui text-sm flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Change cover
                </div>
              )}
            </div>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file, "cover");
            }}
          />
        </div>

        {/* Avatar */}
        <div>
          <label className="block font-ui text-sm text-ink mb-3">
            Profile Photo
          </label>
          <div className="flex items-center gap-6">
            <div
              className="relative w-24 h-24 rounded-full overflow-hidden cursor-pointer group"
              onClick={() => avatarInputRef.current?.click()}
            >
              <img
                src={form.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200"}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {avatarUploading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <p className="font-ui text-sm text-ink">Click to upload</p>
              <p className="font-body text-xs text-muted mt-1">
                Recommended: Square image, at least 200x200px
              </p>
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file, "avatar");
            }}
          />
        </div>

        {/* Display Name */}
        <div>
          <label className="block font-ui text-sm text-ink mb-2">
            Display Name
          </label>
          <input
            type="text"
            name="display_name"
            value={form.display_name}
            onChange={handleChange}
            placeholder="Your display name"
            className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
          />
        </div>

        {/* Username (read-only) */}
        <div>
          <label className="block font-ui text-sm text-ink mb-2">
            Username
          </label>
          <div className="flex items-center">
            <span className="px-4 py-3 bg-skeleton rounded-l-xl font-ui text-muted text-sm border-r border-border-light">
              @
            </span>
            <input
              type="text"
              name="username"
              value={form.username}
              disabled
              className="flex-1 px-4 py-3 rounded-r-xl bg-skeleton/60 border-none outline-none font-body text-muted cursor-not-allowed"
            />
          </div>
          <p className="font-body text-xs text-muted mt-2">
            Username cannot be changed
          </p>
        </div>

        {/* Tagline */}
        <div>
          <label className="block font-ui text-sm text-ink mb-2">
            Tagline
          </label>
          <input
            type="text"
            name="tagline"
            value={form.tagline}
            onChange={handleChange}
            placeholder="A short tagline about yourself"
            maxLength={100}
            className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block font-ui text-sm text-ink mb-2">
            Bio
          </label>
          <textarea
            name="bio"
            value={form.bio}
            onChange={handleChange}
            placeholder="Tell us about yourself..."
            rows={4}
            maxLength={500}
            className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all resize-none"
          />
          <p className="font-body text-xs text-muted mt-1 text-right">
            {form.bio.length}/500
          </p>
        </div>

        {/* Role */}
        <div>
          <label className="block font-ui text-sm text-ink mb-2">
            Role / Profession
          </label>
          <input
            type="text"
            name="role"
            value={form.role}
            onChange={handleChange}
            placeholder="e.g., Writer, Poet, Artist"
            className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block font-ui text-sm text-ink mb-2">
            Location
          </label>
          <input
            type="text"
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="Where are you based?"
            className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
          />
        </div>

        {/* Education */}
        <div>
          <label className="block font-ui text-sm text-ink mb-2">
            Education
          </label>
          <input
            type="text"
            name="education"
            value={form.education}
            onChange={handleChange}
            placeholder="Your educational background"
            className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
          />
        </div>

        {/* Languages */}
        <div>
          <label className="block font-ui text-sm text-ink mb-2">
            Languages
          </label>
          <input
            type="text"
            name="languages"
            value={form.languages}
            onChange={handleChange}
            placeholder="e.g., English, Spanish, French"
            className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
          />
          <p className="font-body text-xs text-muted mt-2">
            Separate multiple languages with commas
          </p>
        </div>

        {/* Social Links */}
        <div>
          <label className="block font-ui text-sm text-ink mb-2">
            Social Links & Websites
          </label>
          <p className="font-body text-xs text-muted mb-4">
            Add your social media profiles and websites. The platform is auto-detected from URLs.
          </p>

          {/* Existing Links */}
          {socialLinks.length > 0 && (
            <div className="space-y-3 mb-4">
              {socialLinks.map((link, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-skeleton/60">
                  <select
                    value={link.platform}
                    onChange={(e) => handleUpdatePlatform(index, e.target.value)}
                    className="w-36 px-3 py-2 rounded-lg bg-surface border border-border-light font-ui text-sm text-ink focus:ring-2 focus:ring-purple-primary/20 outline-none"
                  >
                    {Object.entries(PLATFORMS).map(([key, { name }]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={link.url}
                    onChange={(e) => {
                      const updated = [...socialLinks];
                      updated[index].url = e.target.value;
                      setSocialLinks(updated);
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-surface border border-border-light font-body text-sm text-ink focus:ring-2 focus:ring-purple-primary/20 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveLink(index)}
                    className="w-9 h-9 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Link */}
          <div className="flex items-center gap-3">
            <select
              value={newLinkPlatform}
              onChange={(e) => setNewLinkPlatform(e.target.value)}
              className="w-36 px-3 py-3 rounded-xl bg-skeleton/60 border-none font-ui text-sm text-ink focus:ring-2 focus:ring-purple-primary/20 outline-none"
            >
              {Object.entries(PLATFORMS).map(([key, { name }]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
            <input
              type="text"
              value={newLinkUrl}
              onChange={(e) => {
                setNewLinkUrl(e.target.value);
                // Auto-detect platform from URL
                const detected = detectPlatform(e.target.value);
                if (detected !== "website") {
                  setNewLinkPlatform(detected);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddLink();
                }
              }}
              placeholder="Enter URL or username"
              className="flex-1 px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
            />
            <button
              type="button"
              onClick={handleAddLink}
              disabled={!newLinkUrl.trim()}
              className="px-5 py-3 rounded-xl bg-purple-primary text-white font-ui text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Add
            </button>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-600 font-ui text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-green-50 text-green-600 font-ui text-sm flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Profile updated successfully!
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving || avatarUploading || coverUploading}
            className="px-8 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
