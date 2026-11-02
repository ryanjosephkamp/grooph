import { STOP_KIND_WORDS, type Graph, type LoopRun, type Replay as ReplayData } from "@grooph/core";
import { useEffect, useRef, useState } from "react";

/**
 * A recorded run, played on its graph: play, a step at a time either way, and
 * a scrubber. Each step is one of the lead's notes (core's `replaySteps`); the
 * picture lights the nodes as the run reached them, the loop chips tick their
 * rounds, and the last step says which stop ended the run.
 */

/** How long each note stays on screen while playing. */
export const STEP_MS = 900;

export const loopRoundText = (run: LoopRun | undefined): string =>
  run === undefined || run.round === null ? "not entered" : `round ${run.round}${run.lastStop?.fired ? ` · ${STOP_KIND_WORDS[run.lastStop.fired]}` : ""}`;

export const reducedMotion = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Replay({
  replay,
  doc,
  step,
  setStep,
  autoplay,
}: {
  replay: ReplayData;
  doc: Graph;
  step: number;
  setStep: (step: number | ((s: number) => number)) => void;
  autoplay: boolean;
}) {
  const last = replay.steps.length - 1;
  const [playing, setPlaying] = useState(() => autoplay && !reducedMotion() && last > 0);
  const current = replay.steps[step]!;
  const atEnd = step === last;
  const playButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStep((s) => Math.min(s + 1, last)), STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, step, last, setStep]);

  const play = () => {
    if (playing) return setPlaying(false);
    if (atEnd) setStep(0);
    setPlaying(true);
  };
  const stepBy = (d: number) => {
    setPlaying(false);
    setStep((s) => Math.min(Math.max(s + d, 0), last));
  };

  const caption = atEnd && step > 0 ? replay.end.line : current.caption;

  return (
    <section className="gx-replay" aria-label="Replay of the run">
      <div className="gx-replay-row">
        <button ref={playButton} type="button" className="gx-btn gx-play" aria-label={playing ? "Pause" : atEnd ? "Play the run from the start" : "Play"} onClick={play} disabled={last === 0}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {playing ? <path d="M8 5v14M16 5v14" /> : atEnd ? <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" /> : <path d="M7 5v14l12-7z" className="gx-fill" />}
          </svg>
        </button>
        <button type="button" className="gx-btn gx-icon" aria-label="Previous step" onClick={() => stepBy(-1)} disabled={step === 0}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17 6 9 12l8 6zM7 6v12" className="gx-fill" />
          </svg>
        </button>
        <button type="button" className="gx-btn gx-icon" aria-label="Next step" onClick={() => stepBy(1)} disabled={atEnd}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 6 8 6-8 6zM17 6v12" className="gx-fill" />
          </svg>
        </button>
        <input
          className="gx-scrub"
          type="range"
          min={0}
          max={last}
          step={1}
          value={step}
          aria-label="Replay position"
          aria-valuetext={`Step ${step} of ${last}: ${current.caption}`}
          onChange={(e) => {
            setPlaying(false);
            setStep(Number(e.target.value));
          }}
        />
        <span className="gx-count" aria-hidden="true">
          {step}/{last}
        </span>
      </div>
      <p className={`gx-caption${atEnd && step > 0 ? " is-end" : ""}`} aria-live="polite" data-testid="replay-caption">
        {caption}
      </p>
      {doc.loops.length > 0 ? (
        <ul className="gx-loops" aria-label="Loops">
          {doc.loops.map((loop, i) => {
            const run = current.summary.loops[loop.id];
            return (
              <li key={loop.id} className={`gx-loop-chip${run?.lastStop?.fired ? " is-stopped" : ""}`} data-loop-chip={loop.id}>
                <span className={`gx-dot gx-loop-${i % 4}`} aria-hidden="true" />
                {loop.name || loop.id} · <span className="gx-round">{loopRoundText(run)}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
