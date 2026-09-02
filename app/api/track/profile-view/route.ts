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
  const { profile_id, session_id, source } = parsed.data;

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

  // The RPC decides self-view, blocks and follower status server-side —
  // the client used to send `is_follower` and could inflate follower views.
  const { error: insertError } = await supabaseAdmin.rpc("record_profile_view_admin", {
    p_viewer_id: user?.id ?? null,
    p_profile_id: profile_id,
    p_session_id: user ? null : safeSessionId,
    p_source: normalizedSource,
    p_country: geo.country,
    p_region: geo.region,
    p_city: geo.city,
  });

  if (insertError) {
    console.error("[track/profile-view] rpc error:", insertError);
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
