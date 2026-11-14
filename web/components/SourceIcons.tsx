/* eslint-disable @next/next/no-img-element */
import { faviconUrl, type Source } from "@/lib/format";

export function SourceIcons({ sources, max = 4 }: { sources: Source[]; max?: number }) {
  const unique = sources.filter((s, i) => sources.findIndex((x) => x.name === s.name) === i);
  if (unique.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex -space-x-1.5">
        {unique.slice(0, max).map((s) => (
          <img
            key={s.name}
            src={faviconUrl(s.url)}
            alt=""
            width={16}
            height={16}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-4 w-4 rounded-full border border-card bg-card"
          />
        ))}
      </span>
      <span>
        {unique[0].name}
        {unique.length > 1 && ` + ${unique.length - 1} more`}
      </span>
    </span>
  );
}
