import { formatDate, formatTime } from "@/lib/utils/time";
import { weatherIcons, moodIcons } from "@/components/feed/PostCard/journalIcons";
import type { DetailJournalMetadata, DetailTone } from "./types";

function formatWord(value: string) {
  return value.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

interface JournalHeaderProps {
  createdAt: string;
  location?: string | null;
  metadata?: DetailJournalMetadata | null;
  tone: DetailTone;
}

/** Date, time, and the day's weather/mood/place for a journal entry. */
export default function JournalHeader({ createdAt, location, metadata, tone }: JournalHeaderProps) {
  const hasMeta = Boolean(location || metadata?.weather || metadata?.temperature || metadata?.mood);
  return (
    <header className={`pq-journal ${tone.text}`}>
      <div className="pq-journal__when">
        <h2 className="pq-journal__date">{formatDate(createdAt)}</h2>
        <span className={`pq-journal__time ${tone.muted}`}>{formatTime(createdAt)}</span>
      </div>
      {hasMeta && (
        <dl className={`pq-journal__meta ${tone.muted}`}>
          {location && (
            <div>
              <dt className="sr-only">Place</dt>
              <dd>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                {location}
              </dd>
            </div>
          )}
          {(metadata?.weather || metadata?.temperature) && (
            <div>
              <dt className="sr-only">Weather</dt>
              <dd>
                {metadata?.weather && <span className="pq-journal__icon">{weatherIcons[metadata.weather]}</span>}
                {metadata?.temperature}
                {metadata?.temperature && metadata?.weather && " · "}
                {metadata?.weather && formatWord(metadata.weather)}
              </dd>
            </div>
          )}
          {metadata?.mood && (
            <div>
              <dt className="sr-only">Mood</dt>
              <dd>
                <span className="pq-journal__icon">{moodIcons[metadata.mood] || moodIcons.reflective}</span>
                Feeling {formatWord(metadata.mood).toLowerCase()}
              </dd>
            </div>
          )}
        </dl>
      )}
    </header>
  );
}
