"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useUpdateCommunity, CommunityRule } from "@/lib/hooks";

export default function CommunityRulesSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, rules: existingRules, refetch } = useCommunity(slug, user?.id);
  const { updateRules, updating: loading, error } = useUpdateCommunity();

  const [rules, setRules] = useState<{ title: string; description: string }[]>([]);
  const [newRule, setNewRule] = useState({ title: '', description: '' });
  const [success, setSuccess] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (existingRules) {
      setRules(existingRules.map(r => ({ title: r.title, description: r.description || '' })));
    }
  }, [existingRules]);

  if (!community) return null;

  const isAdmin = community.user_role === 'admin';
  const isMod = community.user_role === 'moderator';

  if (!isAdmin && !isMod) {
    router.push(`/community/${slug}`);
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
    <div className="max-w-2xl mx-auto">
      <h2 className="font-display text-xl font-bold text-ink mb-2">Community Rules</h2>
      <p className="font-body text-muted mb-6">
        Set clear guidelines to help members understand community expectations.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Existing Rules */}
        {rules.length > 0 && (
          <div className="space-y-3">
            {rules.map((rule, index) => (
              <div
                key={index}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`group flex items-start gap-3 p-4 bg-white rounded-xl border transition-all cursor-move ${
                  draggedIndex === index ? 'border-purple-primary shadow-lg' : 'border-black/5 hover:border-purple-primary/20'
                }`}
              >
                <div className="flex flex-col items-center gap-1 pt-2 text-muted">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                  <span className="w-6 h-6 rounded-full bg-purple-primary/20 text-purple-primary flex items-center justify-center text-xs font-ui font-semibold">
                    {index + 1}
                  </span>
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={rule.title}
                    onChange={(e) => updateRule(index, 'title', e.target.value)}
                    placeholder="Rule title"
                    className="w-full px-0 py-1 bg-transparent border-0 font-ui font-medium text-ink focus:outline-none focus:ring-0"
                  />
                  <textarea
                    value={rule.description}
                    onChange={(e) => updateRule(index, 'description', e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full px-0 py-1 bg-transparent border-0 font-body text-sm text-muted focus:outline-none focus:ring-0 resize-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-muted hover:text-red-500 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Rule */}
        <div className="p-4 rounded-xl border border-dashed border-black/10 bg-black/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-black/10 text-muted flex items-center justify-center text-xs font-ui font-semibold">
              {rules.length + 1}
            </span>
            <span className="font-ui text-sm font-medium text-muted">Add New Rule</span>
          </div>
          <input
            type="text"
            value={newRule.title}
            onChange={(e) => setNewRule(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Rule title (e.g., Be respectful)"
            className="w-full px-3 py-2 mb-2 bg-white rounded-lg border border-black/5 font-ui text-sm focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
          />
          <textarea
            value={newRule.description}
            onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 mb-3 bg-white rounded-lg border border-black/5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-purple-primary/20 resize-none"
          />
          <button
            type="button"
            onClick={addRule}
            disabled={!newRule.title.trim()}
            className="px-4 py-2 rounded-lg bg-purple-primary/10 text-purple-primary font-ui text-sm font-medium hover:bg-purple-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Rule
          </button>
        </div>

        {rules.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-primary/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-ink mb-2">No rules yet</h3>
            <p className="font-body text-muted">
              Add rules to help members understand community expectations.
            </p>
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
            Rules saved successfully!
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
            disabled={loading}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui font-medium hover:shadow-lg hover:shadow-pink-vivid/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Rules'}
          </button>
        </div>
      </form>
    </div>
  );
}
