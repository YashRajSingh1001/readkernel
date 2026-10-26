"use client";

import { TOPICS, TOPIC_BLURBS } from "@/lib/format";
import { COUNTS, FORMATS, FREQUENCIES, type Prefs } from "@/lib/personal";

type Props = { value: Prefs; onChange: (next: Prefs) => void };

const chip = (on: boolean) =>
  `rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
    on ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink"
  }`;

/** The choices behind "make it yours". Controlled: the parent keeps the value. */
export function PrefsPicker({ value, onChange }: Props) {
  const toggleTopic = (t: string) =>
    onChange({
      ...value,
      topics: value.topics.includes(t) ? value.topics.filter((x) => x !== t) : [...value.topics, t],
    });

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="font-bold">Topics</legend>
        <p className="mb-3 text-sm text-muted">Pick any. Pick none and you get the biggest stories across all of them.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.keys(TOPICS).map((t) => {
            const on = value.topics.includes(t);
            return (
              <button key={t} type="button" aria-pressed={on} onClick={() => toggleTopic(t)} className={chip(on)}>
                <span className="block font-semibold">{TOPICS[t]}</span>
                <span className={`block text-xs ${on ? "opacity-80" : "text-muted"}`}>{TOPIC_BLURBS[t]}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-bold">How many stories</legend>
        <div className="flex gap-2">
          {COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={value.count === n}
              onClick={() => onChange({ ...value, count: n })}
              className={`${chip(value.count === n)} flex-1 text-center`}
            >
              <span className="block text-lg font-bold">{n}</span>
              <span className={`block text-xs ${value.count === n ? "opacity-80" : "text-muted"}`}>
                {n === 5 ? "The essentials" : n === 10 ? "The full picture" : "Everything that moved"}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-bold">How you read it</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={value.format === f.id}
              onClick={() => onChange({ ...value, format: f.id })}
              className={chip(value.format === f.id)}
            >
              <span className="block font-semibold">{f.label}</span>
              <span className={`block text-xs ${value.format === f.id ? "opacity-80" : "text-muted"}`}>{f.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-bold">How often</legend>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={value.frequency === f.id}
              onClick={() => onChange({ ...value, frequency: f.id })}
              className={chip(value.frequency === f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-bold">From company blogs</legend>
        <p className="mb-3 text-sm text-muted">
          One extra pick at the end: how a team at Netflix, Uber, Airbnb or similar built something.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { on: true, label: "Yes, include it" },
            { on: false, label: "No thanks" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={value.companyRead === o.on}
              onClick={() => onChange({ ...value, companyRead: o.on })}
              className={chip(value.companyRead === o.on)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
