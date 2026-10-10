import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { SkillsResponse } from "./types";

const positions = [
  [62, 25, 64, 23], [27, 45, 22, 44], [77, 61, 76, 60], [28, 73, 25, 73],
  [59, 83, 62, 85], [16, 25, 18, 22], [83, 35, 83, 39], [43, 10, 46, 7],
];

function bearing(x: number, y: number) {
  return (Math.atan2(x - 50, 50 - y) * 180 / Math.PI + 360) % 360;
}

interface MarketRadarProps {
  skills: SkillsResponse;
  scope: string;
  onOpenMethodology: () => void;
}

export default function MarketRadar({ skills, scope, onOpenMethodology }: MarketRadarProps) {
  const [view, setView] = useState<"radar" | "list">("radar");
  const [selected, setSelected] = useState(skills.items[0]?.skill ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [scanEnabled, setScanEnabled] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const signalsRef = useRef<HTMLDivElement>(null);
  const pinned = skills.items.find((item) => item.skill === selected) ?? skills.items[0];
  const active = skills.items.find((item) => item.skill === preview) ?? pinned;
  const hasSample = skills.vacancy_denominator > 0;
  const comparing = !!active && !!pinned && active.skill !== pinned.skill;
  const difference = active && pinned ? Math.round((active.share - pinned.share) * 100) : 0;
  const rank = active ? 1 + skills.items.filter((item) => item.vacancies_with_skill > active.vacancies_with_skill).length : 0;
  const tied = active ? skills.items.filter((item) => item.vacancies_with_skill === active.vacancies_with_skill).length > 1 : false;
  const scanning = scanEnabled && visible && pageVisible && !reducedMotion && view === "radar" && !!active;
  const activePoint = positions[Math.max(0, skills.items.findIndex((item) => item.skill === active?.skill)) % positions.length];
  const pinnedPoint = positions[Math.max(0, skills.items.findIndex((item) => item.skill === pinned?.skill)) % positions.length];

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 });
    if (signalsRef.current) observer.observe(signalsRef.current);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => setReducedMotion(preference.matches);
    const onVisibility = () => setPageVisible(!document.hidden);
    preference.addEventListener("change", onPreference);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { observer.disconnect(); preference.removeEventListener("change", onPreference); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  useEffect(() => {
    setPreview(null);
    setSelected((previous) => skills.items.some((item) => item.skill === previous) ? previous : skills.items[0]?.skill ?? "");
  }, [skills]);

  function exploreWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Escape") { setPreview(null); return; }
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % skills.items.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index - 1 + skills.items.length) % skills.items.length
        : event.key === "Home" ? 0 : event.key === "End" ? skills.items.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    signalsRef.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus({ preventScroll: true });
  }

  return (
    <section className="market-radar" data-scanning={scanning} data-view={view} aria-labelledby="radar-heading">
      <div className="radar-heading">
        <div><h2 id="radar-heading">Market Radar<span className="radar-heading-dot" aria-hidden="true" /></h2><p>{scope}</p></div>
        <div className="radar-controls">
          {view === "radar" && <button type="button" className="scan-control" disabled={reducedMotion || !active} aria-pressed={!scanEnabled} onClick={() => setScanEnabled((enabled) => !enabled)} title={reducedMotion ? "Your device requests reduced motion" : "Pause or resume the scanning beam"}>
            <svg viewBox="0 0 16 16" aria-hidden="true">{scanEnabled && !reducedMotion ? <path d="M5 3V13M11 3V13" /> : <path d="M5 3L12 8L5 13Z" />}</svg>{reducedMotion ? "Motion reduced" : scanEnabled ? "Pause scan" : "Resume scan"}
          </button>}
          <div className="radar-view-toggle" role="group" aria-label="Skill signal view">
          <button type="button" aria-pressed={view === "radar"} onClick={() => setView("radar")}>Radar</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
          </div>
        </div>
      </div>

      <p className="radar-guidance" id="radar-guidance"><span className="pointer-guidance">Hover to inspect · Click to pin · Arrow keys to explore</span><span className="touch-guidance">Tap a signal to explore its frequency</span></p>
      <div className="radar-body">
        <div ref={signalsRef} className={view === "radar" ? "radar-plot" : "radar-list"} onPointerLeave={() => setPreview(null)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPreview(null); }}>
          {view === "radar" && <div className="radar-grid" aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <circle className="radar-rim" cx="50" cy="50" r="47" />
              <circle cx="50" cy="50" r="35" /><circle cx="50" cy="50" r="23" /><circle cx="50" cy="50" r="11" />
              <path d="M50 3V97M3 50H97" />
              {Array.from({ length: 60 }, (_, index) => <path className="radar-tick" key={index} d={`M50 3V${index % 5 === 0 ? 5 : 4}`} transform={`rotate(${index * 6} 50 50)`} />)}
              <circle className="radar-origin" cx="50" cy="50" r=".7" />
            </svg>
            {active && <span className="radar-sweep" key={scope} />}
          </div>}
          {view === "radar" && active && <svg className="radar-bearings" viewBox="0 0 100 100" aria-hidden="true">
            <g className="bearings-desktop"><line x1="50" y1="50" x2={pinnedPoint[0]} y2={pinnedPoint[1]} />{comparing && <line className="bearing-preview" x1="50" y1="50" x2={activePoint[0]} y2={activePoint[1]} />}</g>
            <g className="bearings-mobile"><line x1="50" y1="50" x2={pinnedPoint[2]} y2={pinnedPoint[3]} />{comparing && <line className="bearing-preview" x1="50" y1="50" x2={activePoint[2]} y2={activePoint[3]} />}</g>
          </svg>}

          {skills.items.map((item, index) => {
            const point = positions[index % positions.length];
            const share = Math.round(item.share * 100);
            const style = {
              "--x": `${point[0]}%`, "--y": `${point[1]}%`,
              "--mobile-x": `${point[2]}%`, "--mobile-y": `${point[3]}%`,
              "--signal-scale": Math.sqrt(item.share),
              "--echo-delay": `${bearing(point[0], point[1]) / 30}s`,
              "--mobile-echo-delay": `${bearing(point[2], point[3]) / 30}s`,
            } as CSSProperties;
            return <button
              type="button"
              className={view === "radar" ? "radar-signal" : "radar-list-item"}
              style={style}
              key={item.skill}
              aria-pressed={pinned?.skill === item.skill}
              data-preview={comparing && active?.skill === item.skill ? "true" : undefined}
              aria-label={`${item.skill}: ${share}% of ${skills.vacancy_denominator} vacancies`}
              aria-describedby="radar-guidance radar-comparison"
              onPointerEnter={(event) => { if (event.pointerType === "mouse") setPreview(item.skill); }}
              onFocus={() => setPreview(item.skill)}
              onKeyDown={(event) => exploreWithKeyboard(event, index)}
              onClick={() => { setSelected(item.skill); setPreview(null); }}
            >
              <span className="signal-dot" aria-hidden="true" />
              {view === "radar" && <span className="signal-echo" key={scope} aria-hidden="true" />}
              <span className="signal-name">{item.skill}{view === "radar" && <strong className="signal-frequency">{share}%</strong>}{view === "radar" && pinned?.skill === item.skill && <span className="signal-evidence" aria-hidden="true">{item.vacancies_with_skill} of {skills.vacancy_denominator} vacancies</span>}</span>
              {view === "list" && <><span className="radar-list-bar" aria-hidden="true"><span style={{ width: `${share}%` }} /></span><span className="signal-share">{share}%</span></>}
            </button>;
          })}

          {!active && <div className="radar-empty"><strong>{hasSample ? "No classified skills" : "No reviewed skill sample"}</strong><p>{hasSample ? "These vacancies have no skill matches in the current dictionary." : "There are no reviewed vacancies for this selection yet."}</p></div>}
        </div>

        <div className="radar-inspector">
          {active ? <>
            <span className="inspector-caption">{comparing ? `Preview · ${pinned.skill} pinned` : "Pinned skill"}</span>
            <h3>{active.skill}</h3>
            <div className="inspector-share">{Math.round(active.share * 100)}<span>%</span></div>
            <p className="inspector-evidence"><strong>{active.vacancies_with_skill}</strong> of <strong>{skills.vacancy_denominator}</strong> vacancies</p>
            <div className="inspector-meter" aria-hidden="true"><span style={{ transform: `scaleX(${active.share})` }} />{comparing && <i style={{ left: `${pinned.share * 100}%` }} />}</div>
            <p className="inspector-description inspector-comparison" id="radar-comparison" key={`${active.skill}-${scope}`}><strong>{comparing ? difference === 0 ? `Same frequency as ${pinned.skill}` : `${Math.abs(difference)} percentage points ${difference > 0 ? "more" : "less"} frequent than ${pinned.skill}` : `${tied ? "Joint " : ""}#${rank} by frequency in this view`}</strong><span className="pointer-guidance">{comparing ? "Click or press Enter to pin this skill." : "Preview another skill to compare mention rates."}</span><span className="touch-guidance">Tap another signal to explore its frequency.</span></p>
            <a href="#skills" className="radar-link">Compare across fields <span aria-hidden="true">↗</span></a>
          </> : <>
            <h3>{hasSample ? "Skills still unknown" : "Room to explore"}</h3>
            <p className="inspector-description">{hasSample ? "A missing skill match does not mean the role needs no skills." : "Try another field or a broader selection. New fields will appear as reviewed samples become available."}</p>
            <button type="button" onClick={onOpenMethodology} className="radar-link">About the sample <span aria-hidden="true">↗</span></button>
          </>}
        </div>
      </div>
      <div className="radar-footer"><span><i aria-hidden="true" /> {view === "radar" ? "Circle area = frequency · Position is illustrative" : "Share of vacancies mentioning each skill"}</span><span>{skills.items.length} signals · {skills.vacancy_denominator} vacancies · Snapshot data</span></div>
      <p className="sr-only">Signal positions are arranged for readability and do not encode data. Use the List view for a linear comparison.</p>
      <p className="sr-only" role="status">{pinned ? `${pinned.skill} pinned. ${Math.round(pinned.share * 100)}%, ${pinned.vacancies_with_skill} of ${skills.vacancy_denominator} vacancies.` : "No skill signals in this selection."}</p>
    </section>
  );
}
