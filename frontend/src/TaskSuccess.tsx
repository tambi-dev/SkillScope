import type { CSSProperties, ReactNode } from "react";

export function TaskSuccess({ active, children }: { active: boolean; children: ReactNode }) {
  return <div className="starter-feedback starter-feedback-success" role="status">
    <span className="task-completion-mark" data-celebrating={active} aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" /><path d="m11 20 6 6 12-13" /></svg>
      {[[-36, -22], [-20, -36], [7, -40], [30, -28], [40, -4], [29, 22], [-11, 32], [-38, 12]].map(([x, y], index) => <i key={index} style={{ "--x": `${x}px`, "--y": `${y}px`, "--turn": `${index * 47}deg` } as CSSProperties} />)}
    </span>
    {children}
  </div>;
}

export function playCompletionSound() {
  if (!window.AudioContext) return;
  try {
    const context = new AudioContext();
    void context.resume().then(() => {
      const start = context.currentTime;
      [660, 880].forEach((frequency, index) => {
        const tone = context.createOscillator();
        const volume = context.createGain();
        const at = start + index * 0.12;
        tone.type = "sine";
        tone.frequency.value = frequency;
        volume.gain.setValueAtTime(0, at);
        volume.gain.linearRampToValueAtTime(0.055, at + 0.015);
        volume.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
        tone.connect(volume); volume.connect(context.destination);
        tone.start(at); tone.stop(at + 0.24);
      });
      window.setTimeout(() => { void context.close().catch(() => {}); }, 600);
    }).catch(() => { void context.close().catch(() => {}); });
  } catch { /* Completion feedback remains visible when audio is unavailable. */ }
}
