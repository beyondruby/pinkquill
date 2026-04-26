"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { buildAuthenticatedHeaders } from "../auth-client";
import { safeResponseJson } from "../utils/fetch";
import type { DownloadToken } from "../types/store";

// ============================================================================
// useOrderDownloads — Fetch download tokens for an order
// ============================================================================

interface UseOrderDownloadsReturn {
  tokens: DownloadToken[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrderDownloads(orderId?: string): UseOrderDownloadsReturn {
  const [tokens, setTokens] = useState<DownloadToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    if (!orderId) {
      setTokens([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString();
      const { data, error: queryError } = await supabase
        .from("product_download_tokens")
        .select(`
          id, order_id, file_id, token, downloads_used, download_limit, expires_at, created_at,
          file:product_files!file_id (file_url, file_name, file_type, file_size)
        `)
        .eq("order_id", orderId)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at");

      if (queryError) throw queryError;

      setTokens(
        (data || []).map((row: Record<string, unknown>) => ({
          ...row,
          file: Array.isArray(row.file) ? row.file[0] : row.file,
        })) as DownloadToken[]
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useOrderDownloads] Error:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return { tokens, loading, error, refetch: fetchTokens };
}

// ============================================================================
// useGenerateDownloads — Generate download tokens for an order
// ============================================================================

interface UseGenerateDownloadsReturn {
  generate: (orderId: string) => Promise<number>;
  generating: boolean;
  error: string | null;
}

export function useGenerateDownloads(): UseGenerateDownloadsReturn {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (orderId: string): Promise<number> => {
    setGenerating(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "generate_order_download_tokens",
        { p_order_id: orderId }
      );

      if (rpcError) throw rpcError;

      const result = data as { tokens_generated?: number } | null;
      return result?.tokens_generated ?? 0;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useGenerateDownloads] Error:", message);
      setError(message);
      return 0;
    } finally {
      setGenerating(false);
    }
  }, []);

  return { generate, generating, error };
}

// ============================================================================
// useDownloadFile — Consume a download token and get the file URL
// ============================================================================

interface UseDownloadFileReturn {
  download: (token: string) => Promise<{ file_url: string; file_name: string } | null>;
  downloading: boolean;
  error: string | null;
}

export function useDownloadFile(): UseDownloadFileReturn {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async (token: string) => {
    setDownloading(true);
    setError(null);

    try {
      // Server route consumes the token (atomically increments use count
      // + verifies buyer auth) and mints a short-lived signed URL.
      const response = await fetch("/api/orders/download", {
        method: "POST",
        headers: await buildAuthenticatedHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ token }),
      });

      const data = await safeResponseJson<{
        url?: string;
        file_name?: string;
        error?: string;
      }>(response);

      if (!response.ok || !data.url) {
        throw new Error(data.error || `Failed to prepare download (${response.status})`);
      }

      return {
        file_url: data.url,
        file_name: data.file_name ?? "download",
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useDownloadFile] Error:", message);
      setError(message);
      return null;
    } finally {
      setDownloading(false);
    }
  }, []);

  return { download, downloading, error };
}
