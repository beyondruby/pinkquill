"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

// =============================================================================
// useAudioUpload — upload an audio file (music "sound" or "voice" note) to the
// existing public `post-audio` Supabase Storage bucket. Mirrors the upload
// conventions in lib/hooks/useTakes.ts (useCreateTake) and CreatePost.tsx:
// `${user.id}/...` path, getPublicUrl, long cacheControl, friendly error string.
//
// Probes duration client-side via an <audio> element before uploading so we can
// reject over-limit files without wasting an upload round-trip.
// =============================================================================

export type AudioKind = "sound" | "voice";

interface AudioLimits {
  maxBytes: number;
  maxSeconds: number;
}

// kind="sound" → ≤ 50 MB and ≤ 900 s; kind="voice" → ≤ 20 MB and ≤ 300 s.
const LIMITS: Record<AudioKind, AudioLimits> = {
  sound: { maxBytes: 50 * 1024 * 1024, maxSeconds: 900 },
  voice: { maxBytes: 20 * 1024 * 1024, maxSeconds: 300 },
};

// Accepted audio formats — validated by extension and (when present) MIME type.
const ALLOWED_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "ogg"] as const;
type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

// MIME types browsers commonly report for the allowed extensions. We only treat
// MIME as a *blocking* check when it's a recognisable audio type — some browsers
// report an empty or generic type for m4a/aac, so a missing/odd MIME is allowed
// as long as the extension is valid.
const EXTENSION_MIME: Record<AllowedExtension, string[]> = {
  mp3: ["audio/mpeg", "audio/mp3"],
  m4a: ["audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac"],
  aac: ["audio/aac", "audio/aacp", "audio/mp4"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
  ogg: ["audio/ogg", "application/ogg"],
};

// Content-Type we set on upload, keyed by extension (so the bucket serves a
// correct type even when the browser-provided File.type was empty).
const EXTENSION_CONTENT_TYPE: Record<AllowedExtension, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

function getExtension(file: File): AllowedExtension | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
    ? (ext as AllowedExtension)
    : null;
}

/** Probe the duration (seconds) of an audio file without uploading it. */
function probeDurationSec(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";

    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
      URL.revokeObjectURL(url);
    };

    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Could not read the audio file's duration."));
        return;
      }
      resolve(duration);
    };

    audio.onerror = () => {
      cleanup();
      reject(new Error("This file could not be read as audio."));
    };

    audio.src = url;
  });
}

export function useAudioUpload(): {
  uploadAudio: (
    file: File,
    kind: AudioKind
  ) => Promise<{ url: string; durationSec: number } | null>;
  uploading: boolean;
  error: string | null;
} {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAudio = useCallback(
    async (
      file: File,
      kind: AudioKind
    ): Promise<{ url: string; durationSec: number } | null> => {
      setError(null);

      if (!user) {
        setError("You must be signed in to upload audio.");
        return null;
      }

      const limits = LIMITS[kind];

      // 1. Validate extension.
      const ext = getExtension(file);
      if (!ext) {
        setError("Unsupported file type. Use mp3, m4a, aac, wav, or ogg.");
        return null;
      }

      // 2. Validate MIME — only block when the browser reports a *recognisable*
      //    audio MIME that doesn't match the extension. Empty/odd types pass.
      const mime = file.type?.toLowerCase() ?? "";
      if (mime && mime.startsWith("audio/")) {
        const allowedMimes = EXTENSION_MIME[ext];
        if (!allowedMimes.includes(mime)) {
          setError("This file's audio type doesn't match its extension.");
          return null;
        }
      }

      // 3. Validate size.
      if (file.size > limits.maxBytes) {
        const maxMb = Math.round(limits.maxBytes / (1024 * 1024));
        setError(`File is too large. Max ${maxMb} MB for ${kind}.`);
        return null;
      }

      setUploading(true);
      try {
        // 4. Probe + validate duration client-side before uploading.
        let durationSec: number;
        try {
          durationSec = await probeDurationSec(file);
        } catch (probeErr) {
          setError(
            probeErr instanceof Error
              ? probeErr.message
              : "Could not read the audio file."
          );
          return null;
        }

        if (durationSec > limits.maxSeconds) {
          const maxMin = Math.round(limits.maxSeconds / 60);
          setError(`Audio is too long. Max ${maxMin} min for ${kind}.`);
          return null;
        }

        // 5. Upload to the public `post-audio` bucket.
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("post-audio")
          .upload(path, file, {
            cacheControl: "31536000",
            contentType: EXTENSION_CONTENT_TYPE[ext],
            upsert: false,
          });

        if (uploadError) {
          console.error("[useAudioUpload] Storage upload error:", uploadError);
          setError(`Upload failed: ${uploadError.message}`);
          return null;
        }

        const { data: urlData } = supabase.storage
          .from("post-audio")
          .getPublicUrl(path);

        return { url: urlData.publicUrl, durationSec: Math.round(durationSec) };
      } catch (err) {
        console.error("[useAudioUpload] Error:", err);
        setError(err instanceof Error ? err.message : "Failed to upload audio.");
        return null;
      } finally {
        setUploading(false);
      }
    },
    [user]
  );

  return { uploadAudio, uploading, error };
}
