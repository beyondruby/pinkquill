"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

// ============================================================================
// TYPES
// ============================================================================

export interface VoiceRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  waveformData: number[];
  error: string | null;
  hasPermission: boolean;
}

export interface AudioPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  error: string | null;
}

export interface MediaLimits {
  maxImageSize: number; // in bytes
  maxVideoSize: number; // in bytes
  allowedImageTypes: string[];
  allowedVideoTypes: string[];
}

const DEFAULT_MEDIA_LIMITS: MediaLimits = {
  maxImageSize: 10 * 1024 * 1024, // 10MB
  maxVideoSize: 50 * 1024 * 1024, // 50MB
  allowedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  allowedVideoTypes: ["video/mp4", "video/quicktime", "video/webm"],
};

// ============================================================================
// useVoiceRecorder - Record voice notes with waveform visualization
// ============================================================================

export function useVoiceRecorder(maxDuration: number = 300) {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    waveformData: [],
    error: null,
    hasPermission: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Check browser support
  const isSupported =
    typeof window !== "undefined" && navigator.mediaDevices && typeof MediaRecorder !== "undefined";

  // Get best supported MIME type
  const getMimeType = () => {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "audio/webm";
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      setState((prev) => ({ ...prev, error: "Audio recording is not supported in this browser" }));
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setState((prev) => ({ ...prev, hasPermission: true, error: null }));
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : "Microphone permission denied";
      setState((prev) => ({ ...prev, hasPermission: false, error }));
      return false;
    }
  };

  const startRecording = async () => {
    if (!isSupported) {
      setState((prev) => ({ ...prev, error: "Audio recording is not supported" }));
      return;
    }

    try {
      // Reset state
      setState((prev) => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        audioUrl: null,
        waveformData: [],
        error: null,
      }));
      chunksRef.current = [];

      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio context for waveform
      audioContextRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.3;
      source.connect(analyserRef.current);

      // Create media recorder
      const mimeType = getMimeType();
      const options: MediaRecorderOptions = { mimeType };
      if (MediaRecorder.isTypeSupported(mimeType)) {
        options.audioBitsPerSecond = 128000;
      }
      mediaRecorderRef.current = new MediaRecorder(stream, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setState((prev) => ({
          ...prev,
          audioBlob: blob,
          audioUrl: url,
          isRecording: false,
        }));
      };

      // Start recording
      mediaRecorderRef.current.start();
      startTimeRef.current = Date.now();

      setState((prev) => ({ ...prev, isRecording: true, hasPermission: true }));

      // Start duration timer (using monotonic time to prevent drift)
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState((prev) => ({ ...prev, duration: elapsed }));

        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 1000);

      // Start waveform sampling
      const waveformData: number[] = [];
      waveformIntervalRef.current = setInterval(() => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const normalized = average / 255;

          waveformData.push(normalized);
          if (waveformData.length > 100) {
            waveformData.shift();
          }

          setState((prev) => ({ ...prev, waveformData: [...waveformData] }));
        }
      }, 100);
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to start recording";
      setState((prev) => ({ ...prev, error, isRecording: false }));
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      const pausedDuration = state.duration;
      startTimeRef.current = Date.now() - pausedDuration * 1000;
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState((prev) => ({ ...prev, duration: elapsed }));
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 1000);
      setState((prev) => ({ ...prev, isPaused: false }));
    }
  };

  const cancelRecording = () => {
    stopRecording();
    chunksRef.current = [];
    setState((prev) => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      waveformData: [],
    }));
  };

  const reset = () => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    setState((prev) => ({
      ...prev,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      waveformData: [],
      error: null,
    }));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }
    };
  }, []);

  return {
    ...state,
    isSupported,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    requestPermission,
    reset,
  };
}

// ============================================================================
// useAudioPlayer - Play audio files with controls
// ============================================================================

export function useAudioPlayer(audioUrl: string | null) {
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadstart = () => setState((prev) => ({ ...prev, isLoading: true }));
    audio.oncanplay = () => setState((prev) => ({ ...prev, isLoading: false }));
    audio.onloadedmetadata = () => setState((prev) => ({ ...prev, duration: audio.duration }));
    audio.ontimeupdate = () => setState((prev) => ({ ...prev, currentTime: audio.currentTime }));
    audio.onended = () => setState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
    audio.onplay = () => setState((prev) => ({ ...prev, isPlaying: true }));
    audio.onpause = () => setState((prev) => ({ ...prev, isPlaying: false }));
    audio.onerror = () => setState((prev) => ({ ...prev, error: "Failed to load audio", isLoading: false }));

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [audioUrl]);

  const play = () => {
    if (audioRef.current) {
      audioRef.current.play().catch((err) => {
        setState((prev) => ({ ...prev, error: err.message }));
      });
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const toggle = () => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setState((prev) => ({ ...prev, currentTime: time }));
    }
  };

  const setPlaybackRate = (rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      setState((prev) => ({ ...prev, playbackRate: rate }));
    }
  };

  return {
    ...state,
    play,
    pause,
    toggle,
    seek,
    setPlaybackRate,
  };
}

// ============================================================================
// useSendVoiceNote - Upload and send voice notes
// ============================================================================

export function useSendVoiceNote() {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sendVoiceNote = async (
    conversationId: string,
    senderId: string,
    audioBlob: Blob,
    duration: number,
    waveformData: number[]
  ) => {
    setSending(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(10);

      const fileExt = audioBlob.type.includes("webm") ? "webm" : "mp4";
      const fileName = `${senderId}/${conversationId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("voice-notes")
        .upload(fileName, audioBlob, {
          cacheControl: "31536000",
          contentType: audioBlob.type,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setProgress(60);

      const {
        data: { publicUrl },
      } = supabase.storage.from("voice-notes").getPublicUrl(uploadData.path);

      setProgress(70);

      const { data: message, error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: "",
          message_type: "voice",
          voice_url: publicUrl,
          voice_duration: Math.round(duration),
          waveform_data: waveformData,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to save message: ${insertError.message}`);
      }

      setProgress(90);

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      setProgress(100);

      return message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send voice note";
      setError(errorMessage);
      console.error("[useSendVoiceNote] Error:", err);
      return null;
    } finally {
      setSending(false);
    }
  };

  return { sendVoiceNote, sending, progress, error };
}

// ============================================================================
// useSendMedia - Upload and send media files (images/videos)
// ============================================================================

export function useSendMedia(limits: MediaLimits = DEFAULT_MEDIA_LIMITS) {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): { valid: boolean; error?: string; mediaType?: "image" | "video" } => {
    const isImage = limits.allowedImageTypes.includes(file.type);
    const isVideo = limits.allowedVideoTypes.includes(file.type);

    if (!isImage && !isVideo) {
      return {
        valid: false,
        error: `File type not supported. Allowed: ${[...limits.allowedImageTypes, ...limits.allowedVideoTypes].join(", ")}`,
      };
    }

    if (isImage && file.size > limits.maxImageSize) {
      const maxMB = limits.maxImageSize / (1024 * 1024);
      return { valid: false, error: `Image too large. Max size: ${maxMB}MB` };
    }

    if (isVideo && file.size > limits.maxVideoSize) {
      const maxMB = limits.maxVideoSize / (1024 * 1024);
      return { valid: false, error: `Video too large. Max size: ${maxMB}MB` };
    }

    return { valid: true, mediaType: isImage ? "image" : "video" };
  };

  const sendMedia = async (conversationId: string, senderId: string, file: File) => {
    setSending(true);
    setProgress(0);
    setError(null);

    try {
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setProgress(10);

      const ext = file.name.split(".").pop() || (validation.mediaType === "image" ? "jpg" : "mp4");
      const fileName = `${senderId}/${conversationId}/${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("message-media")
        .upload(fileName, file, {
          cacheControl: "31536000",
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setProgress(60);

      const {
        data: { publicUrl },
      } = supabase.storage.from("message-media").getPublicUrl(uploadData.path);

      setProgress(70);

      const { data: message, error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: "",
          message_type: "media",
          media_url: publicUrl,
          media_type: validation.mediaType,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create message: ${insertError.message}`);
      }

      setProgress(90);

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      setProgress(100);

      return message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send media";
      setError(errorMessage);
      console.error("[useSendMedia] Error:", err);
      return null;
    } finally {
      setSending(false);
    }
  };

  return { sendMedia, validateFile, sending, progress, error, limits };
}
