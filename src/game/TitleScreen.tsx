import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sfx } from '@/game/sfx';
import extraArt from '@/assets/title-screen/extra-modes.png.asset.json';
import platformerArt from '@/assets/title-screen/platformer.png.asset.json';
import survivalArt from '@/assets/title-screen/survival.png.asset.json';
import playerPortrait from '@/assets/title-screen/portrait-player.png.asset.json';
import pinkPortrait from '@/assets/title-screen/portrait-pink.png.asset.json';
import runSprite from '@/assets/sprites/run_fast_1.png';
import runSprite2 from '@/assets/sprites/run_fast_2.png';
import '@/game/titleScreen.css';

type Props = {
  modes: boolean;
  onModes: (open: boolean) => void;
  onSettings: () => void;
  onCredits: () => void;
  onExtras: () => void;
  onPlatformer: () => void;
  onSurvival: () => void;
};

function MovingBorder({ bottom = false }: { bottom?: boolean }) {
  return <div aria-hidden="true" className={`authored-border ${bottom ? 'bottom' : 'top'}`}>
    <svg viewBox="0 0 1600 110" preserveAspectRatio="none">
      <path d="M0 0H1600V35L1500 57L1380 40L1280 94L1160 51L1040 73L930 31L800 65L700 57L580 40L480 94L360 51L240 73L130 31L0 65Z" />
    </svg>
  </div>;
}

export default function TitleScreen({ modes, onModes, onSettings, onCredits, onExtras, onPlatformer, onSurvival }: Props) {
  const [catUnlocked] = useState(() => { try { return localStorage.getItem('badge_jrb') === '1'; } catch { return false; } });
  const [portraitSwap, setPortraitSwap] = useState(false);
  const [runFrame, setRunFrame] = useState(false);
  useEffect(() => {
    const portraits = window.setInterval(() => setPortraitSwap(value => !value), 6000);
    const runners = window.setInterval(() => setRunFrame(value => !value), 120);
    return () => { window.clearInterval(portraits); window.clearInterval(runners); };
  }, []);
  const command = (action: () => void) => { sfx.menuClick(); action(); };
  const portraits = portraitSwap ? [pinkPortrait.url, playerPortrait.url] : [playerPortrait.url, pinkPortrait.url];
  return <section className="authored-menu" data-modes={modes} aria-label={modes ? 'Choose a game mode' : 'Title screen'}>
    {!modes && <div className="authored-runners" aria-hidden="true">
      <img className="authored-runner" src={runFrame ? runSprite : runSprite2} alt="" />
      <img className="authored-runner" src={runFrame ? runSprite2 : runSprite} alt="" />
    </div>}
    {modes && <Button variant="ghost" className="authored-back" onClick={() => command(() => onModes(false))}><ArrowLeft /> Back</Button>}
    <div className="authored-menu-content">
      <h1 className="authored-title">Dash Gaem<strong>REMASTERED {catUnlocked && <span className="authored-cat" aria-label="Cat badge unlocked">:3</span>}</strong></h1>
      {!modes ? <div className="authored-console">
        <div className="authored-portrait"><img src={portraits[0]} alt="" /></div>
        <div className="authored-commands">
          {([['Play!', () => onModes(true)], ['Settings', onSettings], ['Credits', onCredits], ['Xtraz', onExtras]] as const).map(([label, action]) =>
            <Button key={label} className="authored-command" onMouseEnter={() => sfx.menuHover()} onClick={() => command(action)}>{label}</Button>)}
        </div>
        <div className="authored-portrait"><img src={portraits[1]} alt="" /></div>
      </div> : <>
        <h2 className="authored-play-label">PLAY!</h2>
        <div className="authored-mode-grid">
          {[
            { id: 'extra', label: 'Irrelevant Modes — Extra Modes', art: extraArt.url, action: onExtras },
            { id: 'platformer', label: 'Platformer — Main Mode', art: platformerArt.url, action: onPlatformer },
            { id: 'survival', label: 'Survival — Horror Mode', art: survivalArt.url, action: onSurvival },
          ].map(mode => <article key={mode.id} className={`authored-mode ${mode.id}`}>
            <div className="authored-mode-art"><img src={mode.art} alt={mode.label} /></div>
            <Button className="authored-start" aria-label={`Start ${mode.label}`} onMouseEnter={() => sfx.menuHover()} onClick={() => command(mode.action)}>START</Button>
          </article>)}
        </div>
      </>}
    </div>
    <MovingBorder /><MovingBorder bottom />
  </section>;
}