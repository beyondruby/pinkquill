import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import StudioProfileWrapper from "@/components/studio/StudioProfileWrapper";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name, bio")
    .eq("username", username)
    .single();

  const displayName = profile?.display_name || `@${username}`;
  const description = profile?.bio || `Check out ${displayName}'s studio on Quill.`;

  return {
    title: `${displayName} | Quill`,
    description,
    openGraph: {
      title: `${displayName} | Quill`,
      description,
    },
  };
}

export default async function StudioPage({ params }: Props) {
  const { username } = await params;
  return <StudioProfileWrapper username={username} />;
}