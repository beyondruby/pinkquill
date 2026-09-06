import { Spinner } from "@/components/ui/Loading";

export default function MessagesLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Loading messages">
      <Spinner size="lg" />
    </div>
  );
}
