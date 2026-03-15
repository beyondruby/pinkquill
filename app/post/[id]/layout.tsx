import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const { data: post } = await supabaseAdmin
    .from("posts")
    .select("title, content, type, author:profiles!posts_author_id_fkey(display_name, username)")
    .eq("id", id)
    .single();

  if (!post) {
    return {
      title: "Post Not Found | Quill",
      description: "This post may have been removed or doesn't exist.",
    };
  }

  const author = Array.isArray(post.author) ? post.author[0] : post.author;
  const authorName = author?.display_name || author?.username || "Unknown";
  const title = post.title || `${authorName}'s ${post.type || "post"}`;
  const plainContent = post.content
    ? post.content.replace(/<[^>]*>/g, "").slice(0, 160)
    : "";
  const description = plainContent || `A ${post.type || "post"} by ${authorName} on Quill.`;

  return {
    title: `${title} | Quill`,
    description,
    openGraph: {
      title: `${title} | Quill`,
      description,
    },
  };
}

export default function PostLayout({ children }: Props) {
  return <>{children}</>;
}
