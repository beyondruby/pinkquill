"use client";

import { memo } from "react";

function SoundBarsComponent() {
  return (
    <div className="sound-bars">
      <div className="sound-bar"></div>
      <div className="sound-bar"></div>
      <div className="sound-bar"></div>
      <div className="sound-bar"></div>
      <div className="sound-bar"></div>
      <div className="sound-bar"></div>
    </div>
  );
}

export const SoundBars = memo(SoundBarsComponent);
export default SoundBars;
