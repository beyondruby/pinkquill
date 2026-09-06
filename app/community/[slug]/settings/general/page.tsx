"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useUpdateCommunity } from "@/lib/hooks.legacy";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import { FieldLabel } from "@/components/create/pieces";
import { CommunitySettingsFrame, Notice } from "@/components/communities/pieces";
import { CommunityMark } from "@/components/communities/CommunityCard";
import "@/components/create/composer.css";
import "@/components/communities/communities.css";

export default function CommunityGeneralSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, refetch } = useCommunity(slug, user?.id);

  // Role gate: redirect from an effect (a router.push during render is a
  // React error and can loop). The proxy already requires a session; the
  // real authorization lives in RLS and the moderation RPCs.
  useEffect(() => {
    if (community && (community.user_role !== "admin" && community.user_role !== "moderator")) {
      router.replace(`/community/${slug}`);
    }
  }, [community, router, slug]);
  const { update, updating: loading, error } = useUpdateCommunity();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 'public' as 'public' | 'private',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (community) {
      setFormData({
        name: community.name,
        description: community.description || '',
        privacy: community.privacy,
      });
      setAvatarPreview(community.avatar_url);
      setCoverPreview(community.cover_url);
    }
  }, [community]);

  if (!community) return null;

  const isAdmin = community.user_role === 'admin';
  const isMod = community.user_role === 'moderator';

  if (!isAdmin && !isMod) {
    return null;
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setCoverPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File, type: 'avatar' | 'cover') => {
    const fileExt = file.name.split('.').pop();
    const fileName = `community-${community.id}-${Date.now()}.${fileExt}`;
    const bucketName = type === 'avatar' ? 'avatars' : 'covers';

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, { cacheControl: '31536000' });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setSuccess(false);

    try {
      let avatar_url = community.avatar_url;
      let cover_url = community.cover_url;

      if (avatarFile) {
        avatar_url = await uploadImage(avatarFile, 'avatar');
      }

      if (coverFile) {
        cover_url = await uploadImage(coverFile, 'cover');
      }

      const result = await update(community.id, {
        name: formData.name,
        description: formData.description,
        privacy: formData.privacy,
        avatar_url: avatar_url ?? undefined,
        cover_url: cover_url ?? undefined,
      });

      if (result.success) {
        setSuccess(true);
        refetch();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error updating community:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <CommunitySettingsFrame community={community} title="General" lede="How the community introduces itself.">
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div>
          <p className="pq-label">Cover</p>
          <div className="pq-image-field">
            {coverPreview ? <img src={coverPreview} alt="" className="pq-image-field__preview" /> : <div className="pq-image-field__preview" aria-hidden="true" />}
            <label className="pq-button pq-button--sm pq-button--secondary cursor-pointer">
              {coverPreview ? "Change cover" : "Add a cover"}
              <input type="file" accept="image/*" onChange={handleCoverChange} className="sr-only" />
            </label>
            <span className="pq-image-field__hint">Wide image, at least 1200×240. Shows as a low band above the name.</span>
          </div>
        </div>

        <div>
          <p className="pq-label">Mark</p>
          <div className="pq-image-field">
            <CommunityMark community={{ name: formData.name || community.name, avatar_url: avatarPreview }} size="lg" />
            <label className="pq-button pq-button--sm pq-button--secondary cursor-pointer">
              {avatarPreview ? "Change mark" : "Add a mark"}
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="sr-only" />
            </label>
            <span className="pq-image-field__hint">Square, at least 200×200. Without one, the first letter is used.</span>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="community-name">Name</FieldLabel>
          <input id="community-name" type="text" className="pq-field" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} maxLength={100} />
        </div>

        <div>
          <FieldLabel htmlFor="community-description" hint={`${formData.description.length}/500`}>What it&rsquo;s for</FieldLabel>
          <textarea id="community-description" className="pq-field" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} rows={4} maxLength={500} />
        </div>

        {isAdmin && (
          <div>
            <p className="pq-label">Who can join</p>
            <div className="pq-choice-grid" role="radiogroup" aria-label="Who can join">
              {[
                { id: "public" as const, label: "Public", desc: "Anyone can join and see the posts." },
                { id: "private" as const, label: "Private", desc: "People ask to join; admins approve." },
              ].map((option) => (
                <button key={option.id} type="button" role="radio" aria-checked={formData.privacy === option.id} className="pq-choice" onClick={() => setFormData((prev) => ({ ...prev, privacy: option.id }))}>
                  <span>
                    <strong className="block font-semibold">{option.label}</strong>
                    <span className="text-sm text-subdued">{option.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <Notice tone="danger">{error}</Notice>}
        {success && <Notice>Saved.</Notice>}

        <div className="pq-settings-foot">
          <Button type="button" variant="ghost" onClick={() => router.push(`/community/${slug}/settings`)}>Cancel</Button>
          <Button type="submit" variant="primary" loading={loading || uploading} loadingText="Saving…">Save</Button>
        </div>
      </form>
    </CommunitySettingsFrame>
  );
}
