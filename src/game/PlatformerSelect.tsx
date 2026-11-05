import { useState } from "react";
import { LEVELS, type LevelId } from "@/game/level";
import { useCharacter } from "@/game/character";
import { sfx } from "@/game/sfx";
import { Button } from "@/components/ui/button";

const NAMES: Record<string, string> = { stick: "The Player", green: "green", dasher: "The Dasher", shadow: "THE ALTERNATE", x3mode: "X3", mmguy: "M&M's Guy" };

type Props = { arts: Record<string, string>; onChange: () => void; onPlay: (id: LevelId) => void };

/** Authored Platformer screen: current-character card + level carousel. */
export default function PlatformerSelect({ arts, onChange, onPlay }: Props) {
  const levels = LEVELS.filter(l => !l.hidden);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const { selected } = useCharacter();
  const level = levels[i];
  const step = (d: number) => { sfx.menuHover(); setDir(d); setI(v => (v + d + levels.length) % levels.length); };

  return <div className="pf-select">
    <div className="pf-char">
      <Button type="button" className="pf-change" onClick={onChange} onMouseEnter={() => sfx.menuHover()}>CHANGE</Button>
      <div className="pf-portrait">

        {arts[selected] && <img src={arts[selected]} alt={NAMES[selected]} />}

      </div>
    </div>
    <div className="pf-levels">
      <Button type="button" className="pf-arrow" aria-label="Previous level" onClick={() => step(-1)}>◀</Button>
      <div className="pf-center">
        <div key={level.id} className="pf-preview" style={{ ["--pf-dir" as string]: dir }}>
          <span className="pf-level-name">{level.name}</span>
          <span className="pf-flag" />
          <span className="pf-sub">{level.subtitle}</span>
          <span className="pf-logo">Dash<br />Gaem<br /><b>Remastered</b></span>
        </div>
        <Button type="button" className="pf-start" disabled={!!level.locked} onClick={() => onPlay(level.id)} onMouseEnter={() => sfx.menuHover()}>
          {level.locked ? "LOCKED" : "START"}
        </Button>
      </div>
      <Button type="button" className="pf-arrow" aria-label="Next level" onClick={() => step(1)}>▶</Button>
    </div>
  </div>;
}
