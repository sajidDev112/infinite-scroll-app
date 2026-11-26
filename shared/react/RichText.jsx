import { parseRich } from '../engine/richText.js';

function Italics({ parts, italicBase }) {
  return parts.map((p, i) =>
    p.italic ? (
      <em key={i} style={{ fontStyle: italicBase ? 'normal' : 'italic' }}>{p.text}</em>
    ) : (
      p.text
    ),
  );
}

/**
 * Text with *italic words* and [linked words](https://…).
 * - Inside text that is already italic, the marked words turn upright instead (the usual
 *   typographic rule), so they still stand out.
 * - `liveLinks` (the published story): links open in a new tab. Otherwise (the editors) they
 *   look the same but don't navigate, so clicking a text box still selects / drags it.
 */
export function RichText({ text, italicBase = false, liveLinks = false }) {
  return parseRich(text).map((p, i) => {
    if (!p.link) return <Italics key={i} parts={[p]} italicBase={italicBase} />;
    const words = <Italics parts={p.parts} italicBase={italicBase} />;
    return liveLinks ? (
      <a key={i} className="sp-link" href={p.link} target="_blank" rel="noopener noreferrer">{words}</a>
    ) : (
      <span key={i} className="sp-link" title={p.link}>{words}</span>
    );
  });
}
