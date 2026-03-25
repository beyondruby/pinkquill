import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/auth-server";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: take } = await supabase
    .from("takes")
    .select("caption, author_id")
    .eq("id", id)
    .single();

  if (!take) {
    return {
      title: "Take Not Found | Quill",
      description: "This take may have been removed or doesn't exist.",
    };
  }

  const { data: author } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", take.author_id)
    .single();

  const authorName = author?.display_name || author?.username || "Unknown";
  const description = take.caption?.slice(0, 160) || `A take by ${authorName} on Quill.`;

  return {
    title: `Take by ${authorName} | Quill`,
    description,
    openGraph: {
      title: `Take by ${authorName} | Quill`,
      description,
    },
  };
}

export default function TakeLayout({ children }: Props) {
  return <>{children}</>;
}
