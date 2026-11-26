import { forwardRef } from 'react';
import { settledState, stateTransform, textBoxStyle, textWrapperStyle } from '../engine/text.js';
import { RichText } from './RichText.jsx';

/**
 * Renders one text element exactly as the viewer does. `state` is the animated
 * state ({opacity,x,y,scale}); omitted → fully settled. `unitPx` is px per design unit.
 * `liveLinks`: links in the text can be clicked (the published story; not the editors).
 */
export const TextElementView = forwardRef(function TextElementView(
  { text, state, unitPx = 1, className = '', style, children, liveLinks = false, ...rest },
  ref,
) {
  const s = state || settledState(text);
  return (
    <div
      ref={ref}
      className={`sp-text ${className}`}
      style={{
        ...textWrapperStyle(text),
        opacity: s.opacity,
        transform: stateTransform(s, unitPx),
        ...style,
      }}
      {...rest}
    >
      <div className="sp-text-box" style={textBoxStyle(text)}>
        <RichText text={text.content} italicBase={text.fontStyle === 'italic'} liveLinks={liveLinks} />
      </div>
      {children}
    </div>
  );
});
