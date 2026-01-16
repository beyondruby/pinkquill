"use client";

import React, { useState } from "react";
import { JournalMetadata, WeatherType, MoodType, TimeOfDay } from "@/lib/types";

interface JournalMetadataPanelProps {
  value: JournalMetadata;
  onChange: (metadata: JournalMetadata) => void;
  location: string;
  onLocationChange: (location: string) => void;
}

// Weather options with icons
const weatherOptions: { id: WeatherType; label: string; icon: string }[] = [
  { id: "sunny", label: "Sunny", icon: "sun" },
  { id: "partly-cloudy", label: "Partly Cloudy", icon: "cloud-sun" },
  { id: "cloudy", label: "Cloudy", icon: "cloud" },
  { id: "rainy", label: "Rainy", icon: "rain" },
  { id: "stormy", label: "Stormy", icon: "storm" },
  { id: "snowy", label: "Snowy", icon: "snow" },
  { id: "foggy", label: "Foggy", icon: "fog" },
  { id: "windy", label: "Windy", icon: "wind" },
];

// Mood options with emojis
const moodOptions: { id: MoodType; label: string; emoji: string }[] = [
  { id: "reflective", label: "Reflective", emoji: "thought" },
  { id: "joyful", label: "Joyful", emoji: "joy" },
  { id: "melancholic", label: "Melancholic", emoji: "sad" },
  { id: "peaceful", label: "Peaceful", emoji: "peace" },
  { id: "anxious", label: "Anxious", emoji: "anxious" },
  { id: "grateful", label: "Grateful", emoji: "grateful" },
  { id: "creative", label: "Creative", emoji: "creative" },
  { id: "nostalgic", label: "Nostalgic", emoji: "nostalgic" },
  { id: "hopeful", label: "Hopeful", emoji: "hopeful" },
  { id: "contemplative", label: "Contemplative", emoji: "contemplative" },
  { id: "excited", label: "Excited", emoji: "excited" },
  { id: "curious", label: "Curious", emoji: "curious" },
  { id: "serene", label: "Serene", emoji: "serene" },
  { id: "restless", label: "Restless", emoji: "restless" },
  { id: "inspired", label: "Inspired", emoji: "inspired" },
  { id: "determined", label: "Determined", emoji: "determined" },
  { id: "vulnerable", label: "Vulnerable", emoji: "vulnerable" },
  { id: "content", label: "Content", emoji: "content" },
  { id: "overwhelmed", label: "Overwhelmed", emoji: "overwhelmed" },
  { id: "lonely", label: "Lonely", emoji: "lonely" },
];

// Time of day options
const timeOptions: { id: TimeOfDay; label: string; icon: string }[] = [
  { id: "morning", label: "Morning", icon: "sunrise" },
  { id: "afternoon", label: "Afternoon", icon: "sun-full" },
  { id: "evening", label: "Evening", icon: "sunset" },
  { id: "night", label: "Night", icon: "moon" },
];

// Weather SVG icons
const weatherIcons: Record<string, React.ReactElement> = {
  sun: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  "cloud-sun": (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M3 15h18M6 18h12" />
      <circle cx="15" cy="9" r="4" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M15 3v1M19.24 5.76l-.7.7M21 10h-1M10.76 5.76l.7.7" />
    </svg>
  ),
  cloud: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 014-4h1a5.5 5.5 0 0110.5 2H19a3 3 0 110 6H7a4 4 0 01-4-4z" />
    </svg>
  ),
  rain: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M3 13a4 4 0 014-4h1a5.5 5.5 0 0110.5 2H19a3 3 0 010 6H7a4 4 0 01-4-4z" />
      <path strokeLinecap="round" strokeWidth="2" d="M8 19v2M12 19v2M16 19v2" />
    </svg>
  ),
  storm: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M3 13a4 4 0 014-4h1a5.5 5.5 0 0110.5 2H19a3 3 0 010 6H7a4 4 0 01-4-4z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17l-2 4 4-2-2 4" />
    </svg>
  ),
  snow: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M3 13a4 4 0 014-4h1a5.5 5.5 0 0110.5 2H19a3 3 0 010 6H7a4 4 0 01-4-4z" />
      <circle cx="8" cy="20" r="1" fill="currentColor" />
      <circle cx="12" cy="21" r="1" fill="currentColor" />
      <circle cx="16" cy="20" r="1" fill="currentColor" />
    </svg>
  ),
  fog: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M4 8h16M6 12h12M4 16h16" />
    </svg>
  ),
  wind: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m12.59-8.41A2 2 0 1118 12H2" />
    </svg>
  ),
};

// Time of day icons
const timeIcons: Record<string, React.ReactElement> = {
  sunrise: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M12 3v3M5.64 5.64l2.12 2.12M3 12h3M5.64 18.36l2.12-2.12" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 18a6 6 0 100-12" />
      <path strokeLinecap="round" strokeWidth="2" d="M2 21h20" />
    </svg>
  ),
  "sun-full": (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  ),
  sunset: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M12 9v3M5.64 5.64l2.12 2.12M3 12h3M5.64 18.36l2.12-2.12M18.36 18.36l-2.12-2.12M21 12h-3M18.36 5.64l-2.12 2.12" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 18a6 6 0 100-12" />
      <path strokeLinecap="round" strokeWidth="2" d="M2 21h20" />
    </svg>
  ),
  moon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
};

// Mood icons (abstract representations)
const moodIcons: Record<string, React.ReactElement> = {
  thought: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  joy: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </svg>
  ),
  sad: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01" />
    </svg>
  ),
  peace: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 8v8M12 8l-4 4M12 8l4 4" />
    </svg>
  ),
  anxious: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M8 15h8M9 9l1 1M14 9l1 1" />
    </svg>
  ),
  grateful: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  creative: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  nostalgic: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  hopeful: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  contemplative: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  excited: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  curious: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  serene: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  restless: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  ),
  inspired: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  determined: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  vulnerable: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  content: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  overwhelmed: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  lonely: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
};

const locationIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const thermometerIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19c-2.21 0-4-1.79-4-4 0-1.48.81-2.77 2-3.46V5c0-1.1.9-2 2-2s2 .9 2 2v6.54c1.19.69 2 1.98 2 3.46 0 2.21-1.79 4-4 4z" />
  </svg>
);

export default function JournalMetadataPanel({
  value,
  onChange,
  location,
  onLocationChange,
}: JournalMetadataPanelProps) {
  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");
  const [tempValue, setTempValue] = useState(
    value.temperature?.replace(/[°CF]/g, "") || ""
  );

  const handleWeatherChange = (weather: WeatherType) => {
    onChange({ ...value, weather });
  };

  const handleMoodChange = (mood: MoodType) => {
    onChange({ ...value, mood });
  };

  const handleTimeChange = (timeOfDay: TimeOfDay) => {
    onChange({ ...value, timeOfDay });
  };

  const handleTempChange = (val: string) => {
    setTempValue(val);
    if (val) {
      onChange({ ...value, temperature: `${val}°${tempUnit}` });
    } else {
      onChange({ ...value, temperature: undefined });
    }
  };

  const toggleTempUnit = () => {
    const newUnit = tempUnit === "C" ? "F" : "C";
    setTempUnit(newUnit);
    if (tempValue) {
      onChange({ ...value, temperature: `${tempValue}°${newUnit}` });
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-primary/5 via-pink-vivid/5 to-orange-warm/5 border border-purple-primary/10">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div>
          <h3 className="font-ui text-sm font-semibold text-ink">Journal Details</h3>
          <p className="font-ui text-xs text-muted">Add context to your entry</p>
        </div>
      </div>

      {/* Location Input */}
      <div className="mb-4">
        <label className="font-ui text-xs text-muted uppercase tracking-wide mb-1.5 block">
          Location
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-primary">
            {locationIcon}
          </div>
          <input
            type="text"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="Paris, France"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-purple-primary/20 bg-white font-ui text-sm text-ink focus:outline-none focus:border-purple-primary transition-colors placeholder:text-muted/50"
          />
        </div>
      </div>

      {/* Time of Day */}
      <div className="mb-4">
        <label className="font-ui text-xs text-muted uppercase tracking-wide mb-1.5 block">
          Time of Day
        </label>
        <div className="grid grid-cols-4 gap-2">
          {timeOptions.map((time) => (
            <button
              key={time.id}
              onClick={() => handleTimeChange(time.id)}
              className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl transition-all ${
                value.timeOfDay === time.id
                  ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white shadow-lg shadow-purple-primary/30"
                  : "bg-white border border-gray-200 text-muted hover:border-purple-primary/50 hover:text-purple-primary"
              }`}
            >
              {timeIcons[time.icon]}
              <span className="text-[10px] font-ui font-medium">{time.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Weather */}
      <div className="mb-4">
        <label className="font-ui text-xs text-muted uppercase tracking-wide mb-1.5 block">
          Weather
        </label>
        <div className="grid grid-cols-4 gap-2">
          {weatherOptions.map((weather) => (
            <button
              key={weather.id}
              onClick={() => handleWeatherChange(weather.id)}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all ${
                value.weather === weather.id
                  ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white shadow-lg shadow-purple-primary/30"
                  : "bg-white border border-gray-200 text-muted hover:border-purple-primary/50 hover:text-purple-primary"
              }`}
              title={weather.label}
            >
              {weatherIcons[weather.icon]}
              <span className="text-[9px] font-ui">{weather.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Temperature */}
      <div className="mb-4">
        <label className="font-ui text-xs text-muted uppercase tracking-wide mb-1.5 block">
          Temperature
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-primary">
              {thermometerIcon}
            </div>
            <input
              type="number"
              value={tempValue}
              onChange={(e) => handleTempChange(e.target.value)}
              placeholder="15"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-purple-primary/20 bg-white font-ui text-sm text-ink focus:outline-none focus:border-purple-primary transition-colors placeholder:text-muted/50"
            />
          </div>
          <button
            onClick={toggleTempUnit}
            className="px-4 py-2.5 rounded-xl border border-purple-primary/20 bg-white font-ui text-sm font-medium text-purple-primary hover:bg-purple-primary/5 transition-colors"
          >
            °{tempUnit}
          </button>
        </div>
      </div>

      {/* Mood */}
      <div>
        <label className="font-ui text-xs text-muted uppercase tracking-wide mb-1.5 block">
          Mood
        </label>
        <div className="grid grid-cols-5 gap-2">
          {moodOptions.map((mood) => (
            <button
              key={mood.id}
              onClick={() => handleMoodChange(mood.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                value.mood === mood.id
                  ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white shadow-lg shadow-purple-primary/30"
                  : "bg-white border border-gray-200 text-muted hover:border-purple-primary/50 hover:text-purple-primary"
              }`}
              title={mood.label}
            >
              {moodIcons[mood.emoji]}
              <span className="text-[8px] font-ui leading-tight text-center">{mood.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
