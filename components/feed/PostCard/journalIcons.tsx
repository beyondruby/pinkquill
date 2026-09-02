// Journal metadata icons (weather + mood), shared by the classic card and the
// post modal. Monochrome SVG — colour inherits from currentColor.
import type { ReactNode } from "react";

// Weather icons for journal display
export const weatherIcons: Record<string, ReactNode> = {
  'sunny': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
  'partly-cloudy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 0 0-4.9 4.03A5 5 0 0 0 3 11a5 5 0 0 0 5 5h9a4 4 0 0 0 0-8h-.35A5 5 0 0 0 12 2z"/></svg>,
  'cloudy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 18H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 18z"/></svg>,
  'rainy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 13H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 13zM8 17l-2 4M12 17l-2 4M16 17l-2 4"/></svg>,
  'stormy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 13H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 13zM13 14l-4 8h5l-1 4"/></svg>,
  'snowy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 13H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 13zM8 16h.01M12 16h.01M16 16h.01M8 20h.01M12 20h.01M16 20h.01"/></svg>,
  'foggy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 14h16M4 18h12M4 10h8"/></svg>,
  'windy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M9.59 4.59A2 2 0 1 1 11 8H2M12.59 19.41A2 2 0 1 0 14 16H2M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"/></svg>,
};

// Time of day icons
export const timeOfDayIcons: Record<string, ReactNode> = {
  'morning': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7a5 5 0 0 0 0 10M2 12h2M20 12h2M6.34 6.34l1.42 1.42M16.24 16.24l1.42 1.42M6.34 17.66l1.42-1.42M16.24 7.76l1.42-1.42"/></svg>,
  'afternoon': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
  'evening': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v3M18.36 5.64l-2.12 2.12M21 12h-3M18.36 18.36l-2.12-2.12M12 21v-3M5.64 18.36l2.12-2.12M3 12h3M5.64 5.64l2.12 2.12"/></svg>,
  'night': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
};

// Mood icons
export const moodIcons: Record<string, ReactNode> = {
  'reflective': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>,
  'joyful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>,
  'melancholic': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01"/></svg>,
  'peaceful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14h8M9 9h.01M15 9h.01"/></svg>,
  'anxious': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M8 9h2M14 9h2"/></svg>,
  'grateful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  'creative': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  'nostalgic': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  'hopeful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  'contemplative': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>,
  'excited': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
  'curious': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  'serene': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>,
  'restless': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/></svg>,
  'inspired': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>,
  'determined': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>,
  'vulnerable': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>,
  'content': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  'overwhelmed': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  'lonely': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
};
