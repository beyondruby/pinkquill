import StudioProfileWrapper from "@/components/studio/StudioProfileWrapper";

interface Props {
  params: Promise<{ username: string }>;
}

export default async function StudioPage({ params }: Props) {
  const { username } = await params;
  return <StudioProfileWrapper username={username} />;
}