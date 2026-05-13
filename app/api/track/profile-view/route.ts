import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import {
  checkRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
  safeJsonParse,
} from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface TrackProfileViewPayload {
  profile_id?: string;
  session_id?: string;
  source?: string;
  is_follower?: boolean;
}

function decodeHeader(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function extractGeo(request: Request) {
  const country = decodeHeader(
    request.headers.get("x-vercel-ip-country") ??
      request.headers.get("cf-ipcountry")
  );
  const region = decodeHeader(
    request.headers.get("x-vercel-ip-country-region") ??
      request.headers.get("cf-region-code")
  );
  const city = decodeHeader(
    request.headers.get("x-vercel-ip-city") ?? request.headers.get("cf-ipcity")
  );

  return {
    country: country && country.length <= 2 ? country.toUpperCase() : country,
    region: region || null,
    city: city || null,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const originDecision = enforceSameOrigin(request);
  if (originDecision) return originDecision;

  const parsed = await safeJsonParse<TrackProfileViewPayload>(request);
  if ("error" in parsed) return parsed.error;
  const { profile_id, session_id, source, is_follower } = parsed.data;

  if (!profile_id || !UUID_RE.test(profile_id)) {
    return NextResponse.json({ error: "Invalid profile_id" }, { status: 400 });
  }

  const user = await getAuthUser(request);

  const rl = await checkRateLimit({
    request,
    scope: "track:profile-view",
    limit: 60,
    windowSeconds: 60,
    userId: user?.id,
  });
  if (!rl.allowed) return rateLimitResponse(rl, 60);

  if (user?.id === profile_id) {
    return NextResponse.json({ ok: true, skipped: "self" });
  }

  const safeSessionId = !user && session_id
    ? String(session_id).slice(0, 64)
    : null;

  if (!user && !safeSessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const geo = extractGeo(request);
  const normalizedSource =
    typeof source === "string" && source.length <= 32 ? source : "direct";

  const { error: insertError } = await supabaseAdmin
    .from("profile_views")
    .upsert(
      {
        profile_id,
        viewer_id: user?.id ?? null,
        session_id: user ? null : safeSessionId,
        source: normalizedSource,
        is_follower: Boolean(is_follower),
        country: geo.country,
        region: geo.region,
        city: geo.city,
      },
      {
        onConflict: user
          ? "profile_id,viewer_id,view_date"
          : "profile_id,session_id,view_date",
        ignoreDuplicates: true,
      }
    );

  if (insertError) {
    console.error("[track/profile-view] insert error:", insertError);
    return NextResponse.json({ error: "Failed to record view" }, { status: 500 });
  }

  if (user?.id && geo.country) {
    const { error: locError } = await supabaseAdmin
      .from("user_locations")
      .upsert(
        {
          user_id: user.id,
          country: geo.country,
          region: geo.region,
          city: geo.city,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (locError) {
      console.error("[track/profile-view] user_locations error:", locError);
    }
  }

  return NextResponse.json({ ok: true });
}
