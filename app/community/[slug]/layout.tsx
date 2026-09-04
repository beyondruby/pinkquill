import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/auth-server";
import CommunityLayoutClient from "./CommunityLayoutClient";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: community } = await supabase
    .from("communities")
    .select("name, description")
    .eq("slug", slug)
    .single();

  if (!community) {
    return {
      title: "Community Not Found | PinkQuill",
      description: "This community may have been removed or doesn't exist.",
    };
  }

  const description = community.description?.slice(0, 160) || `Join the ${community.name} community on Quill.`;

  return {
    title: `${community.name} | PinkQuill`,
    description,
    openGraph: {
      title: `${community.name} | PinkQuill`,
      description,
    },
  };
}

export default function CommunitySlugLayout({ children }: Props) {
  return <CommunityLayoutClient>{children}</CommunityLayoutClient>;
}
