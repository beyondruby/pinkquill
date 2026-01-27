"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCreateCommunity } from "@/lib/hooks";

// ===========================================
// HIERARCHICAL CATEGORY SYSTEM
// ===========================================

interface CategoryData {
  id: string;
  name: string;
  genres: string[];
}

const CATEGORIES: CategoryData[] = [
  { id: 'writing', name: 'Writing & Literature', genres: ['Poetry', 'Fiction', 'Non-Fiction', 'Short Stories', 'Novels', 'Essays', 'Screenwriting', 'Playwriting', 'Journalism', 'Memoir', 'Fanfiction', 'Flash Fiction', 'Blogging', 'Spoken Word', 'Lyrics', 'Zines', 'Literary Criticism', 'Haiku', 'Prose Poetry', 'Experimental'] },
  { id: 'visual_arts', name: 'Visual Arts', genres: ['Digital Art', 'Traditional Art', 'Illustration', 'Concept Art', 'Character Design', 'Graphic Design', '3D Art', 'Comics', 'Manga', 'Animation', 'Abstract', 'Portraits', 'Landscapes', 'Surrealism', 'Pop Art', 'Impressionism', 'Minimalism', 'Street Art', 'Graffiti', 'Collage', 'Mixed Media', 'Printmaking', 'Sculpture', 'Installation Art'] },
  { id: 'performing_arts', name: 'Performing Arts', genres: ['Theater', 'Dance', 'Ballet', 'Contemporary Dance', 'Hip-Hop Dance', 'Choreography', 'Acting', 'Improvisation', 'Stand-Up Comedy', 'Spoken Word', 'Opera', 'Musical Theater', 'Circus Arts', 'Performance Art', 'Drag', 'Puppetry', 'Voice Acting', 'Motion Capture'] },
  { id: 'music', name: 'Music & Audio', genres: ['Hip-Hop', 'Rock', 'Pop', 'Electronic', 'Jazz', 'Classical', 'R&B', 'Indie', 'Folk', 'Lo-Fi', 'Ambient', 'Songwriting', 'Covers', 'Production', 'Beats', 'Orchestra', 'A Cappella', 'Experimental', 'World Music', 'Soul', 'Punk', 'Metal', 'Blues', 'Acoustic', 'Vocal', 'Instrumental'] },
  { id: 'film', name: 'Film & Video', genres: ['Short Films', 'Documentaries', 'Music Videos', 'Animation', 'Vlogs', 'Cinematography', 'Editing', 'VFX', 'Film Analysis', 'Horror', 'Comedy', 'Drama', 'Experimental Film', 'Stop Motion', 'Motion Graphics', 'Color Grading', 'Sound Design', 'Directing', 'Screenwriting', 'Film Scoring'] },
  { id: 'photography', name: 'Photography', genres: ['Portrait', 'Landscape', 'Street', 'Fashion', 'Product', 'Wildlife', 'Architecture', 'Fine Art', 'Black & White', 'Travel', 'Food', 'Conceptual', 'Documentary', 'Analog', 'Darkroom', 'Photo Manipulation', 'Macro', 'Astrophotography', 'Underwater', 'Aerial', 'Event'] },
  { id: 'fashion_design', name: 'Fashion & Design', genres: ['Fashion Design', 'Costume Design', 'Textile Art', 'Pattern Making', 'Sustainable Fashion', 'Streetwear', 'Haute Couture', 'Accessories', 'Jewelry Design', 'Shoe Design', 'Makeup Artistry', 'Hair Styling', 'Nail Art', 'Body Art', 'Fashion Illustration', 'Styling', 'Upcycling'] },
  { id: 'crafts', name: 'Crafts & Handmade', genres: ['Ceramics', 'Pottery', 'Woodworking', 'Metalwork', 'Glasswork', 'Leathercraft', 'Bookbinding', 'Paper Art', 'Origami', 'Embroidery', 'Knitting', 'Crochet', 'Weaving', 'Quilting', 'Sewing', 'Jewelry Making', 'Candle Making', 'Soap Making', 'Resin Art', 'Macramé', 'Calligraphy', 'Lettering'] },
  { id: 'digital_creative', name: 'Digital Creative', genres: ['UI/UX Design', 'Web Design', 'Motion Design', 'Brand Design', 'Digital Illustration', '3D Modeling', '3D Animation', 'Game Art', 'NFT Art', 'Generative Art', 'AI Art', 'VR/AR Art', 'Interactive Media', 'Creative Coding', 'Pixel Art', 'Icon Design', 'Infographics'] },
  { id: 'architecture', name: 'Architecture & Spaces', genres: ['Architecture', 'Interior Design', 'Landscape Design', 'Urban Planning', 'Sustainable Design', 'Furniture Design', 'Exhibition Design', 'Set Design', 'Lighting Design', 'Spatial Design', 'Architectural Visualization', 'Model Making'] },
  { id: 'gaming', name: 'Gaming & Interactive', genres: ['RPG', 'Strategy', 'Indie Games', 'Retro', 'Horror', 'Adventure', 'Game Dev', 'Game Design', 'Level Design', 'Game Writing', 'Game Art', 'Esports', 'Reviews', 'Speedrunning', 'Modding', 'Tabletop', 'Board Games', 'Card Games'] },
  { id: 'technology', name: 'Creative Tech', genres: ['Creative Coding', 'Generative Art', 'Interactive Installations', 'Projection Mapping', 'Hardware Hacking', 'Arduino', 'Raspberry Pi', 'Wearable Tech', 'Sound Engineering', 'Live Visuals', 'VJing', 'AI Tools', 'Open Source', 'Web Dev'] },
  { id: 'lifestyle', name: 'Lifestyle & Wellness', genres: ['Fashion', 'Food', 'Travel', 'Fitness', 'Wellness', 'Home Decor', 'DIY', 'Self-Improvement', 'Minimalism', 'Journaling', 'Bullet Journal', 'Plant Care', 'Sustainable Living', 'Vintage', 'Thrifting'] },
  { id: 'education', name: 'Learning & Critique', genres: ['Art History', 'Music Theory', 'Film Studies', 'Design Theory', 'Writing Craft', 'Critique Groups', 'Mentorship', 'Workshops', 'Tutorials', 'Book Club', 'Portfolio Review', 'Career Advice', 'Art Business', 'Creative Process'] },
  { id: 'culture', name: 'Culture & Community', genres: ['Art Movements', 'Cultural Heritage', 'Folk Art', 'Indigenous Art', 'Diaspora Art', 'Zine Culture', 'Fan Art', 'Fan Fiction', 'Cosplay', 'Conventions', 'Local Scene', 'Collectives', 'Collaborations', 'Open Calls', 'Residencies'] },
];

const THEMES = [
  // Mood & Emotion
  'Dark', 'Light', 'Romantic', 'Melancholic', 'Uplifting', 'Intense', 'Peaceful', 'Mysterious', 'Ethereal', 'Raw', 'Intimate', 'Dreamy', 'Haunting', 'Joyful', 'Bittersweet', 'Provocative', 'Contemplative', 'Playful', 'Tender', 'Fierce',
  // Style & Aesthetic
  'Minimalist', 'Maximalist', 'Surreal', 'Abstract', 'Realistic', 'Vintage', 'Retro', 'Modern', 'Contemporary', 'Classic', 'Avant-Garde', 'Bohemian', 'Gothic', 'Cyberpunk', 'Cottagecore', 'Dark Academia', 'Kawaii', 'Brutalist', 'Art Deco', 'Baroque',
  // Setting & Environment
  'Nature', 'Urban', 'Cosmic', 'Underwater', 'Fantasy', 'Dystopian', 'Utopian', 'Domestic', 'Industrial', 'Sacred', 'Liminal', 'Nocturnal',
  // Concept & Approach
  'Experimental', 'Traditional', 'Hybrid', 'Lo-Fi', 'Hi-Fi', 'Handmade', 'Polished', 'Rough', 'Layered', 'Monochrome', 'Vibrant', 'Muted', 'Textured', 'Geometric', 'Organic', 'Narrative', 'Symbolic', 'Political', 'Personal', 'Universal'
];

const COMMUNITY_TYPES = [
  { id: 'showcase', name: 'Showcase' },
  { id: 'workshop', name: 'Workshop' },
  { id: 'discussion', name: 'Discussion' },
  { id: 'collaboration', name: 'Collaboration' },
  { id: 'critique', name: 'Critique' },
  { id: 'challenge', name: 'Challenge' },
  { id: 'mentorship', name: 'Mentorship' },
  { id: 'networking', name: 'Networking' },
  { id: 'collective', name: 'Collective' },
  { id: 'archive', name: 'Archive' },
];

export default function CreateCommunityPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { create, creating: loading, error } = useCreateCommunity();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    privacy: 'public' as 'public' | 'private',
    category: null as string | null,
    selectedGenres: [] as string[],
    selectedThemes: [] as string[],
    customGenres: [] as string[],
    customThemes: [] as string[],
    newGenre: '',
    newTheme: '',
    communityType: null as string | null,
    rules: [] as { title: string; description: string }[],
  });
  const [newRule, setNewRule] = useState({ title: '', description: '' });

  const selectedCategory = CATEGORIES.find(c => c.id === formData.category);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({ ...prev, name, slug: generateSlug(name) }));
  };

  const selectCategory = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      category: prev.category === categoryId ? null : categoryId,
      selectedGenres: prev.category === categoryId ? prev.selectedGenres : [],
    }));
  };

  const toggleGenre = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      selectedGenres: prev.selectedGenres.includes(genre)
        ? prev.selectedGenres.filter(g => g !== genre)
        : [...prev.selectedGenres, genre]
    }));
  };

  const toggleTheme = (theme: string) => {
    setFormData(prev => ({
      ...prev,
      selectedThemes: prev.selectedThemes.includes(theme)
        ? prev.selectedThemes.filter(t => t !== theme)
        : [...prev.selectedThemes, theme]
    }));
  };

  const selectCommunityType = (typeId: string) => {
    setFormData(prev => ({
      ...prev,
      communityType: prev.communityType === typeId ? null : typeId
    }));
  };

  const addRule = () => {
    if (newRule.title.trim()) {
      setFormData(prev => ({
        ...prev,
        rules: [...prev.rules, { title: newRule.title.trim(), description: newRule.description.trim() }]
      }));
      setNewRule({ title: '', description: '' });
    }
  };

  const removeRule = (index: number) => {
    setFormData(prev => ({ ...prev, rules: prev.rules.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    if (!user) return;

    const tagsWithType = [
      ...formData.selectedGenres.map(tag => ({ tag, tag_type: 'genre' })),
      ...formData.selectedThemes.map(tag => ({ tag, tag_type: 'theme' })),
      ...(formData.communityType ? [{ tag: formData.communityType, tag_type: 'type' }] : []),
    ];

    const result = await create({
      name: formData.name,
      slug: formData.slug,
      description: formData.description,
      privacy: formData.privacy,
      topics: formData.category ? [selectedCategory?.name || ''] : [],
      tags: tagsWithType,
      rules: formData.rules,
    }, user.id);

    if (result.success && result.community) {
      router.push(`/community/${result.community.slug}`);
    }
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <h1 className="font-display text-2xl text-ink mb-3">Sign in to create a community</h1>
        <p className="font-body text-muted">You need to be logged in to create a community.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <p className="font-ui text-[0.65rem] tracking-[0.2em] uppercase text-purple-primary mb-2">New Community</p>
        <h1 className="font-display text-2xl text-ink">Create your space</h1>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <button
              onClick={() => s < step && setStep(s)}
              disabled={s > step}
              className={`w-8 h-8 rounded-full font-ui text-xs font-medium transition-all ${
                s === step
                  ? 'bg-purple-primary text-white'
                  : s < step
                  ? 'bg-purple-primary/20 text-purple-primary cursor-pointer'
                  : 'bg-black/5 text-muted'
              }`}
            >
              {s}
            </button>
            {s < 3 && (
              <div className={`flex-1 h-px ${s < step ? 'bg-purple-primary/30' : 'bg-black/10'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Basics */}
      {step === 1 && (
        <div className="space-y-10">
          <div>
            <label className="block font-ui text-xs tracking-wide text-muted mb-3">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Give your community a name"
              className="w-full px-0 py-2 bg-transparent border-0 border-b border-black/10 font-body text-lg text-ink placeholder:text-muted/40 focus:outline-none focus:border-purple-primary transition-colors"
              maxLength={100}
              autoFocus
            />
          </div>

          <div>
            <label className="block font-ui text-xs tracking-wide text-muted mb-3">URL</label>
            <div className="flex items-baseline gap-0.5 py-2 border-b border-black/10 focus-within:border-purple-primary transition-colors">
              <span className="font-body text-lg text-muted/30">pinkquill.app/c/</span>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }))}
                className="flex-1 bg-transparent border-0 font-body text-lg text-ink focus:outline-none"
                placeholder="community-name"
                maxLength={50}
              />
            </div>
          </div>

          <div>
            <label className="block font-ui text-xs tracking-wide text-muted mb-3">
              Description <span className="text-muted/50">(optional)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What is this community about?"
              rows={3}
              className="w-full px-0 py-2 bg-transparent border-0 border-b border-black/10 font-body text-base text-ink placeholder:text-muted/40 focus:outline-none focus:border-purple-primary transition-colors resize-none"
              maxLength={500}
            />
          </div>

          <div>
            <label className="block font-ui text-xs tracking-wide text-muted mb-5">Visibility</label>
            <div className="flex gap-3">
              {[
                { id: 'public', label: 'Public', desc: 'Anyone can join' },
                { id: 'private', label: 'Private', desc: 'Invite only' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, privacy: option.id as 'public' | 'private' }))}
                  className={`flex-1 py-4 px-5 rounded-xl text-left transition-all ${
                    formData.privacy === option.id
                      ? 'bg-purple-primary/5 ring-1 ring-purple-primary'
                      : 'bg-black/[0.02] hover:bg-black/[0.04]'
                  }`}
                >
                  <span className={`font-ui text-sm font-medium block ${
                    formData.privacy === option.id ? 'text-purple-primary' : 'text-ink'
                  }`}>{option.label}</span>
                  <span className="font-body text-xs text-muted">{option.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={() => setStep(2)}
              disabled={!formData.name.trim() || !formData.slug.trim()}
              className="w-full py-3.5 rounded-xl bg-purple-primary text-white font-ui text-sm font-medium hover:bg-purple-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Category & Details */}
      {step === 2 && (
        <div className="space-y-12">
          {/* Category */}
          <div>
            <label className="block font-ui text-xs tracking-wide text-muted mb-5">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => selectCategory(category.id)}
                  className={`group py-3 px-4 rounded-lg text-left transition-all ${
                    formData.category === category.id
                      ? 'bg-purple-primary'
                      : 'hover:bg-black/[0.03]'
                  }`}
                >
                  <span className={`font-ui text-[0.8rem] transition-colors ${
                    formData.category === category.id
                      ? 'text-white'
                      : 'text-ink/70 group-hover:text-ink'
                  }`}>
                    {category.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Genres - only show when category selected */}
          {selectedCategory && (
            <div className="animate-fadeIn">
              <div className="flex items-baseline justify-between mb-5">
                <label className="font-ui text-xs tracking-wide text-muted">Genres</label>
                {formData.selectedGenres.length > 0 && (
                  <span className="font-ui text-xs text-purple-primary">{formData.selectedGenres.length} selected</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedCategory.genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`px-3.5 py-1.5 rounded-full font-ui text-[0.8rem] transition-all ${
                      formData.selectedGenres.includes(genre)
                        ? 'bg-purple-primary text-white'
                        : 'bg-black/[0.04] text-ink/60 hover:bg-black/[0.07] hover:text-ink'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
                {formData.customGenres?.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className="px-3.5 py-1.5 rounded-full font-ui text-[0.8rem] bg-purple-primary text-white"
                  >
                    {genre}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.newGenre || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, newGenre: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formData.newGenre?.trim()) {
                      const genre = formData.newGenre.trim();
                      if (!formData.selectedGenres.includes(genre)) {
                        setFormData(prev => ({
                          ...prev,
                          selectedGenres: [...prev.selectedGenres, genre],
                          customGenres: [...(prev.customGenres || []), genre],
                          newGenre: ''
                        }));
                      }
                    }
                  }}
                  placeholder="Add custom genre"
                  className="flex-1 px-3.5 py-2 rounded-full bg-black/[0.03] border border-dashed border-black/10 font-ui text-[0.8rem] text-ink placeholder:text-muted/40 focus:outline-none focus:border-purple-primary/40"
                />
              </div>
            </div>
          )}

          {/* Themes */}
          {selectedCategory && (
            <div className="animate-fadeIn">
              <div className="flex items-baseline justify-between mb-5">
                <label className="font-ui text-xs tracking-wide text-muted">
                  Themes <span className="text-muted/50">(optional)</span>
                </label>
                {formData.selectedThemes.length > 0 && (
                  <span className="font-ui text-xs text-pink-vivid">{formData.selectedThemes.length} selected</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {THEMES.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => toggleTheme(theme)}
                    className={`px-3.5 py-1.5 rounded-full font-ui text-[0.8rem] transition-all ${
                      formData.selectedThemes.includes(theme)
                        ? 'bg-pink-vivid text-white'
                        : 'bg-black/[0.04] text-ink/60 hover:bg-black/[0.07] hover:text-ink'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
                {formData.customThemes?.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => toggleTheme(theme)}
                    className="px-3.5 py-1.5 rounded-full font-ui text-[0.8rem] bg-pink-vivid text-white"
                  >
                    {theme}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.newTheme || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, newTheme: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formData.newTheme?.trim()) {
                      const theme = formData.newTheme.trim();
                      if (!formData.selectedThemes.includes(theme)) {
                        setFormData(prev => ({
                          ...prev,
                          selectedThemes: [...prev.selectedThemes, theme],
                          customThemes: [...(prev.customThemes || []), theme],
                          newTheme: ''
                        }));
                      }
                    }
                  }}
                  placeholder="Add custom theme"
                  className="flex-1 px-3.5 py-2 rounded-full bg-black/[0.03] border border-dashed border-black/10 font-ui text-[0.8rem] text-ink placeholder:text-muted/40 focus:outline-none focus:border-pink-vivid/40"
                />
              </div>
            </div>
          )}

          {/* Purpose */}
          {selectedCategory && (
            <div className="animate-fadeIn">
              <label className="block font-ui text-xs tracking-wide text-muted mb-5">
                Purpose <span className="text-muted/50">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMUNITY_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => selectCommunityType(type.id)}
                    className={`px-3.5 py-1.5 rounded-full font-ui text-[0.8rem] transition-all ${
                      formData.communityType === type.id
                        ? 'bg-purple-primary text-white'
                        : 'bg-black/[0.04] text-ink/60 hover:bg-black/[0.07] hover:text-ink'
                    }`}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-6">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3.5 rounded-xl bg-black/[0.03] text-ink font-ui text-sm font-medium hover:bg-black/[0.06] transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!formData.category}
              className="flex-1 py-3.5 rounded-xl bg-purple-primary text-white font-ui text-sm font-medium hover:bg-purple-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Rules & Create */}
      {step === 3 && (
        <div className="space-y-10">
          {/* Rules */}
          <div>
            <label className="block font-ui text-xs tracking-wide text-muted mb-5">
              Rules <span className="text-muted/50">(optional)</span>
            </label>

            {formData.rules.length > 0 && (
              <div className="space-y-3 mb-6">
                {formData.rules.map((rule, index) => (
                  <div key={index} className="py-4 px-5 rounded-xl bg-black/[0.02]">
                    <div className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-purple-primary/10 text-purple-primary flex items-center justify-center flex-shrink-0 font-ui text-[0.65rem] font-bold mt-0.5">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-ui text-sm font-medium text-ink">{rule.title}</p>
                        {rule.description && (
                          <p className="font-body text-sm text-muted mt-1">{rule.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        className="text-muted/30 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 p-5 rounded-xl border border-dashed border-black/10">
              <input
                type="text"
                value={newRule.title}
                onChange={(e) => setNewRule(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Rule title"
                className="w-full px-0 py-1 bg-transparent border-0 font-ui text-sm text-ink placeholder:text-muted/40 focus:outline-none"
              />
              <textarea
                value={newRule.description}
                onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-0 py-1 bg-transparent border-0 font-body text-sm text-muted placeholder:text-muted/30 focus:outline-none resize-none"
              />
              <button
                type="button"
                onClick={addRule}
                disabled={!newRule.title.trim()}
                className="px-4 py-2 rounded-lg bg-purple-primary/10 text-purple-primary font-ui text-xs font-medium hover:bg-purple-primary/20 transition-colors disabled:opacity-30"
              >
                Add Rule
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="py-6 border-t border-black/5">
            <p className="font-ui text-xs tracking-wide text-muted mb-4">Summary</p>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="font-body text-sm text-muted">Name</dt>
                <dd className="font-ui text-sm text-ink">{formData.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm text-muted">Category</dt>
                <dd className="font-ui text-sm text-ink">{selectedCategory?.name}</dd>
              </div>
              {formData.selectedGenres.length > 0 && (
                <div className="flex justify-between">
                  <dt className="font-body text-sm text-muted">Genres</dt>
                  <dd className="font-ui text-sm text-ink text-right max-w-[60%]">
                    {formData.selectedGenres.slice(0, 3).join(', ')}
                    {formData.selectedGenres.length > 3 && ` +${formData.selectedGenres.length - 3}`}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="font-body text-sm text-muted">Visibility</dt>
                <dd className="font-ui text-sm text-ink capitalize">{formData.privacy}</dd>
              </div>
            </dl>
          </div>

          {error && (
            <div className="py-3 px-4 rounded-xl bg-red-50 text-red-600 font-ui text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3.5 rounded-xl bg-black/[0.03] text-ink font-ui text-sm font-medium hover:bg-black/[0.06] transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3.5 rounded-xl bg-purple-primary text-white font-ui text-sm font-medium hover:bg-purple-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? 'Creating...' : 'Create Community'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
