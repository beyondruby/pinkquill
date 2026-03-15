import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import CommunityLayoutClient from "./CommunityLayoutClient";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const { data: community } = await supabaseAdmin
    .from("communities")
    .select("name, description")
    .eq("slug", slug)
    .single();

  if (!community) {
    return {
      title: "Community Not Found | Quill",
      description: "This community may have been removed or doesn't exist.",
    };
  }

  const description = community.description?.slice(0, 160) || `Join the ${community.name} community on Quill.`;

  return {
    title: `${community.name} | Quill`,
    description,
    openGraph: {
      title: `${community.name} | Quill`,
      description,
    },
  };
}

export default function CommunitySlugLayout({ children }: Props) {
  return <CommunityLayoutClient>{children}</CommunityLayoutClient>;
}
