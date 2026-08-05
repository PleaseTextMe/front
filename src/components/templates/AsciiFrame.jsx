import React from 'react';

function AsciiFrame({ children }) {
  // абуз с overflow чтобы длинная строка рамки обрезалась под размер экрана
  return (
    <div className="ascii-frame">
      <div className="ascii-row">
        <span>+</span><span className="ascii-line-h"></span><span>+</span>
      </div>
      <div className="ascii-body">
        <div className="ascii-line-v"></div>
        <div className="ascii-content">{children}</div>
        <div className="ascii-line-v"></div>
      </div>
      <div className="ascii-row">
        <span>+</span><span className="ascii-line-h"></span><span>+</span>
      </div>
    </div>
  );
}

export default AsciiFrame;
