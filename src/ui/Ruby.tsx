import { Fragment } from 'react';
import { hasReadingAids, rubyUnits, type Segment } from '../ai/index.ts';
import type { LanguageCode } from '../sim/index.ts';

/**
 * Text with its reading over it: one `<ruby>` per hanzi, or per run of kanji
 * without their okurigana. React builds it from text nodes, never from HTML.
 */
export function RubyText({ language, segments }: { language: LanguageCode; segments: Segment[] }) {
  if (!hasReadingAids(language)) return <>{segments.map((segment) => segment.base).join('')}</>;
  return (
    <>
      {rubyUnits(language, segments).map((unit, i) =>
        unit.reading ? (
          <ruby key={i}>
            {unit.base}
            <rt>{unit.reading}</rt>
          </ruby>
        ) : (
          <Fragment key={i}>{unit.base}</Fragment>
        ),
      )}
    </>
  );
}

/** A zh or ja line with its reading aid, or the plain text while it has none. */
export function ReadingLine({ language, text, segments }: { language: LanguageCode; text: string; segments: Segment[] | null | undefined }) {
  if (!segments) return <span lang={language}>{text}</span>;
  return (
    <span lang={language} className="reading-line">
      <RubyText language={language} segments={segments} />
    </span>
  );
}
