import { forwardRef } from 'react';
import { settledState, stateTransform, textBoxStyle, textWrapperStyle } from '../engine/text.js';

/**
 * Renders one text element exactly as the viewer does. `state` is the animated
 * state ({opacity,x,y,scale}); omitted → fully settled. `unitPx` is px per design unit.
 */
export const TextElementView = forwardRef(function TextElementView(
  { text, state, unitPx = 1, className = '', style, children, ...rest },
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
        {text.content}
      </div>
      {children}
    </div>
  );
});
