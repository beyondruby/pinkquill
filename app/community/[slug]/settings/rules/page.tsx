"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useUpdateCommunity } from "@/lib/hooks.legacy";
import Button from "@/components/ui/Button";
import { CommunitySettingsFrame, Notice } from "@/components/communities/pieces";
import "@/components/create/composer.css";
import "@/components/communities/communities.css";

export default function CommunityRulesSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, rules: existingRules, refetch } = useCommunity(slug, user?.id);

  // Role gate: redirect from an effect (a router.push during render is a
  // React error and can loop). The proxy already requires a session; the
  // real authorization lives in RLS and the moderation RPCs.
  useEffect(() => {
    if (community && (community.user_role !== "admin" && community.user_role !== "moderator")) {
      router.replace(`/community/${slug}`);
    }
  }, [community, router, slug]);
  const { updateRules, updating: loading, error } = useUpdateCommunity();

  const [rules, setRules] = useState<{ title: string; description: string }[]>(() => {
    // Initialize from existingRules if available
    if (existingRules) {
      return existingRules.map(r => ({ title: r.title, description: r.description || '' }));
    }
    return [];
  });
  const [newRule, setNewRule] = useState({ title: '', description: '' });
  const [success, setSuccess] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [rulesInitialized, setRulesInitialized] = useState(false);

  // Sync external data to local form state - this is a legitimate use case
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (existingRules && !rulesInitialized) {
      setRules(existingRules.map(r => ({ title: r.title, description: r.description || '' })));
      setRulesInitialized(true);
    }
  }, [existingRules, rulesInitialized]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!community) return null;

  const isAdmin = community.user_role === 'admin';
  const isMod = community.user_role === 'moderator';

  if (!isAdmin && !isMod) {
    return null;
  }

  const addRule = () => {
    if (newRule.title.trim()) {
      setRules(prev => [...prev, { title: newRule.title.trim(), description: newRule.description.trim() }]);
      setNewRule({ title: '', description: '' });
    }
  };

  const removeRule = (index: number) => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: 'title' | 'description', value: string) => {
    setRules(prev => prev.map((rule, i) =>
      i === index ? { ...rule, [field]: value } : rule
    ));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newRules = [...rules];
    const [removed] = newRules.splice(draggedIndex, 1);
    newRules.splice(index, 0, removed);
    setRules(newRules);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);

    const result = await updateRules(community.id, rules);

    if (result.success) {
      setSuccess(true);
      refetch();
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <CommunitySettingsFrame community={community} title="Rules" lede="What members agree to. Short titles, a line of why. Drag to reorder.">
      <form onSubmit={handleSubmit} className="grid gap-5">
        {rules.length > 0 ? (
          <ol className="grid gap-2 list-none p-0 m-0" aria-label="Rules">
            {rules.map((rule, index) => (
              <li
                key={index}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="pq-rule pq-rule--editable"
                style={draggedIndex === index ? { borderColor: "var(--color-action)" } : undefined}
              >
                <span className="pq-rule__handle" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 8h16M4 16h16" /></svg>
                </span>
                <span className="pq-rule__num">{index + 1}</span>
                <span className="pq-rule__text">
                  <input type="text" className="pq-field pq-field--ui" value={rule.title} onChange={(e) => updateRule(index, "title", e.target.value)} placeholder="Rule" aria-label={`Rule ${index + 1}`} />
                  <textarea className="pq-field" value={rule.description} onChange={(e) => updateRule(index, "description", e.target.value)} placeholder="Why it matters here (optional)" aria-label={`Rule ${index + 1} description`} rows={2} />
                </span>
                <button type="button" className="pq-icon-button" onClick={() => removeRule(index)} aria-label={`Remove rule ${index + 1}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="w-4 h-4"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="pq-feed-state pq-feed-state--card">
            <p className="pq-feed-state__title">No rules yet</p>
            <p className="pq-feed-state__text">A few clear rules tell people what this space is for. Pinkquill&rsquo;s guidelines always apply.</p>
          </div>
        )}

        <div className="pq-panel grid gap-2">
          <p className="pq-panel__title">Add a rule</p>
          <input type="text" className="pq-field pq-field--ui" value={newRule.title} onChange={(e) => setNewRule((prev) => ({ ...prev, title: e.target.value }))} placeholder="A rule, in a few words" aria-label="New rule" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRule(); } }} />
          <textarea className="pq-field" value={newRule.description} onChange={(e) => setNewRule((prev) => ({ ...prev, description: e.target.value }))} placeholder="Why it matters here (optional)" aria-label="New rule description" rows={2} />
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={addRule} disabled={!newRule.title.trim()}>Add rule</Button>
          </div>
        </div>

        {error && <Notice tone="danger">{error}</Notice>}
        {success && <Notice>Rules saved.</Notice>}

        <div className="pq-settings-foot">
          <Button type="button" variant="ghost" onClick={() => router.push(`/community/${slug}/settings`)}>Cancel</Button>
          <Button type="submit" variant="primary" loading={loading} loadingText="Saving…">Save rules</Button>
        </div>
      </form>
    </CommunitySettingsFrame>
  );
}
