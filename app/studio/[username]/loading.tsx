import { PageFrame } from "@/components/layout/PageFrame";
import "@/components/studio/studio.css";

export default function StudioLoading() {
  return (
    <PageFrame width="wide" className="pq-studio">
      <div className="pq-studio-loading" role="status" aria-label="Loading studio">
        <span className="pq-studio-loading__cover" />
        <span className="pq-studio-loading__avatar" />
        <span className="pq-studio-loading__line" style={{ inlineSize: "14rem" }} />
        <span className="pq-studio-loading__line" style={{ inlineSize: "7rem" }} />
        <span className="pq-studio-loading__line" style={{ inlineSize: "22rem" }} />
      </div>
    </PageFrame>
  );
}
