"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useUpdateCommunity } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";

export default function CommunityGeneralSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, refetch } = useCommunity(slug, user?.id);
  const { update, loading, error } = useUpdateCommunity();

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
    router.push(`/community/${slug}`);
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
    <div className="max-w-2xl mx-auto">
      <h2 className="font-display text-xl font-bold text-ink mb-6">General Settings</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cover Image */}
        <div>
          <label className="block font-ui text-sm font-medium text-ink mb-2">
            Cover Image
          </label>
          <div className="relative h-40 rounded-xl overflow-hidden bg-gradient-to-br from-purple-primary/20 to-pink-vivid/20 border border-black/5">
            {coverPreview && (
              <img
                src={coverPreview}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
              <span className="px-4 py-2 rounded-lg bg-white/90 text-ink font-ui text-sm font-medium">
                Change Cover
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Avatar */}
        <div>
          <label className="block font-ui text-sm font-medium text-ink mb-2">
            Avatar
          </label>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-purple-primary to-pink-vivid">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                  {formData.name.charAt(0).toUpperCase()}
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            </div>
            <p className="font-body text-sm text-muted">
              Recommended: Square image, at least 200x200px
            </p>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block font-ui text-sm font-medium text-ink mb-2">
            Community Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl bg-white border border-black/5 font-ui text-sm focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary/30 transition-all"
            maxLength={100}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block font-ui text-sm font-medium text-ink mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-white border border-black/5 font-ui text-sm focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary/30 transition-all resize-none"
            maxLength={500}
          />
        </div>

        {/* Privacy (Admin Only) */}
        {isAdmin && (
          <div>
            <label className="block font-ui text-sm font-medium text-ink mb-2">
              Privacy
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, privacy: 'public' }))}
                className={`p-4 rounded-xl border text-left transition-all ${
                  formData.privacy === 'public'
                    ? 'border-purple-primary bg-purple-primary/5'
                    : 'border-black/5 hover:border-purple-primary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                  </svg>
                  <span className="font-ui font-semibold text-ink">Public</span>
                </div>
                <p className="font-body text-xs text-muted">Anyone can join</p>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, privacy: 'private' }))}
                className={`p-4 rounded-xl border text-left transition-all ${
                  formData.privacy === 'private'
                    ? 'border-purple-primary bg-purple-primary/5'
                    : 'border-black/5 hover:border-purple-primary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="font-ui font-semibold text-ink">Private</span>
                </div>
                <p className="font-body text-xs text-muted">Request to join</p>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-ui text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-600 font-ui text-sm flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Settings saved successfully!
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push(`/community/${slug}/settings`)}
            className="px-5 py-2.5 rounded-full bg-black/5 text-ink font-ui font-medium hover:bg-black/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || uploading}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui font-medium hover:shadow-lg hover:shadow-pink-vivid/30 transition-all disabled:opacity-50"
          >
            {loading || uploading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
