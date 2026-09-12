import { useCallback, useEffect, useRef, useState } from "react";
import type { DialogueLine, DialogueScript } from "./dialogue";
import { sfx } from "../sfx";

// MAYHEM dialogue system — presentation layer.
//
// Usage:
//   <DialogueBox script={MAYHEM_SCRIPTS.intro} onDone={() => start()} />
//
// Behaviour:
//   - types one character at a time with a blip
//   - click / Space / Enter finishes the current line, then advances
//   - Esc (or the SKIP button) skips the whole script
//   - `auto` lines advance themselves after they finish typing (+ `hold`)

const DEFAULT_SPEED = 34;

export type DialogueBoxProps = {
  script: DialogueScript;
  onDone?: () => void;
  /** Hide the SKIP control (e.g. mandatory story beats). */
  allowSkip?: boolean;
  className?: string;
};

export default function DialogueBox({ script, onDone, allowSkip = true, className }: DialogueBoxProps) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const line: DialogueLine | undefined = script.lines[index];
  const full = line?.text ?? "";
  const typing = shown < full.length;

  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone?.();
  }, [onDone]);

  // Restart cleanly whenever the script changes.
  useEffect(() => {
    doneRef.current = false;
    setIndex(0);
    setShown(0);
  }, [script.id]);

  // Typewriter.
  useEffect(() => {
    if (!line || !typing) return;
    const speed = line.speed ?? DEFAULT_SPEED;
    const id = window.setTimeout(() => {
      setShown((n) => {
        const next = n + 1;
        const ch = full[n];
        if (ch && ch !== " ") sfx.dialogueBlip(0.92 + ((n * 7) % 9) / 40);
        return next;
      });
    }, speed);
    return () => window.clearTimeout(id);
  }, [line, typing, shown, full]);

  const advance = useCallback(() => {
    if (!line) return;
    if (shown < full.length) {
      setShown(full.length);
      return;
    }
    sfx.dialogueAdvance();
    if (index + 1 >= script.lines.length) finish();
    else {
      setIndex(index + 1);
      setShown(0);
    }
  }, [line, shown, full.length, index, script.lines.length, finish]);

  // Auto-advance lines / post-line hold.
  useEffect(() => {
    if (!line || typing) return;
    const hold = line.hold ?? 0;
    if (!line.auto && hold <= 0) return;
    const id = window.setTimeout(advance, line.auto ? Math.max(hold, 700) : hold);
    return () => window.clearTimeout(id);
  }, [line, typing, advance]);

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        advance();
      } else if (e.key === "Escape" && allowSkip) {
        e.preventDefault();
        sfx.dialogueAdvance();
        finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, allowSkip, finish]);

  if (!line) return null;

  const accent = line.color ?? "0 0% 78%";

  return (
    <div
      className={["mayhem-dialogue", line.shake && typing ? "mayhem-dialogue-shake" : "", className || ""]
        .filter(Boolean)
        .join(" ")}
      style={{ ["--dlg-accent" as string]: accent }}
      onClick={advance}
      role="button"
      tabIndex={0}
      aria-live="polite"
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") e.preventDefault();
      }}
    >
      {line.speaker && <span className="mayhem-dialogue-name font-pixel">{line.speaker}</span>}
      <div className="mayhem-dialogue-body">
        {line.portrait && (
          <img src={line.portrait} alt="" aria-hidden="true" className="mayhem-dialogue-portrait" draggable={false} />
        )}
        <p className="mayhem-dialogue-text font-pixel">
          {full.slice(0, shown)}
          <span className="mayhem-dialogue-caret" aria-hidden="true">{typing ? "" : "▎"}</span>
        </p>
      </div>
      <div className="mayhem-dialogue-foot font-pixel">
        <span>{typing ? "" : "CLICK / SPACE"}</span>
        {allowSkip && (
          <button
            type="button"
            className="mayhem-dialogue-skip"
            onClick={(e) => {
              e.stopPropagation();
              sfx.dialogueAdvance();
              finish();
            }}
          >
            SKIP
          </button>
        )}
      </div>
    </div>
  );
}
