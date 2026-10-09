import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ShoppingBag } from "lucide-react";
import DialogueBox from "./DialogueBox";
import { MERCHANT_DIALOGUE, MERCHANT_EXPRESSIONS } from "./merchantDialogue";
import { MERCHANT_UPGRADES, upgradeCost, type UpgradeId } from "./merchantRules";
import comic from "@/assets/mayhem/later/The_tutorial_of_madness-2.png.asset.json";
import shopPortrait from "@/assets/mayhem/receptionist/Reception_in_shop_corner_table.png.asset.json";
import music from "@/assets/audio/receptionist-shop.mp3.asset.json";
import { addTokens, getShop, subscribeShop } from "@/game/shop";
import { getSettings, useSettings } from "@/game/settings";
import { sfx } from "@/game/sfx";
import { isBgmMuted, playMayhemMainBgm, stopBgm } from "@/game/bgm";

type Phase = "intro" | "comic" | "thanks" | "bag" | "offer" | "shop";
export default function ReceptionistMerchant({ seen, freeUsed, purchased, paused, onSeen, onBuy, onClose }: {
  seen: boolean; freeUsed: boolean; purchased: UpgradeId[]; paused: boolean;
  onSeen: () => void; onBuy: (id: UpgradeId) => void; onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(seen ? "shop" : "intro");
  const [lineIndex, setLineIndex] = useState(0);
  const expression = phase === "bag" ? MERCHANT_EXPRESSIONS.bag
    : phase === "thanks" ? MERCHANT_EXPRESSIONS.thanks[lineIndex] ?? MERCHANT_EXPRESSIONS.thanks[0]
    : phase === "offer" ? MERCHANT_EXPRESSIONS.offer[lineIndex] ?? MERCHANT_EXPRESSIONS.offer[0]
    : MERCHANT_EXPRESSIONS.intro[lineIndex] ?? MERCHANT_EXPRESSIONS.intro[0];
  const [, refresh] = useState(0);
  const [settings] = useSettings();
  useEffect(() => subscribeShop(() => refresh((n) => n + 1)), []);
  useEffect(() => { stopBgm(0); return () => { playMayhemMainBgm(); }; }, []);
  useEffect(() => {
    if (phase !== "bag" || paused) return;
    const context = new AudioContext();
    const buffer = context.createBuffer(1, context.sampleRate * 1.4, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / context.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(t * 19), 2) * (1 - t / 1.4);
    }
    const source = context.createBufferSource(); source.buffer = buffer;
    const filter = context.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 1800;
    const gain = context.createGain(); gain.gain.value = getSettings().sfxVolume * 0.25;
    source.connect(filter).connect(gain).connect(context.destination); source.start();
    const timer = window.setTimeout(() => setPhase("offer"), 1500);
    return () => { clearTimeout(timer); source.stop(); void context.close(); };
  }, [phase, paused]);
  useEffect(() => {
    if (phase !== "shop") return;
    const audio = new Audio(music.url); audio.loop = true;
    audio.volume = isBgmMuted() ? 0 : settings.bgmVolume * 0.65;
    if (!paused) void audio.play().catch(() => undefined);
    return () => { audio.pause(); audio.removeAttribute("src"); audio.load(); };
  }, [phase, paused, settings.bgmVolume]);
  const openShop = () => { onSeen(); setPhase("shop"); };
  const buy = (id: UpgradeId) => {
    const cost = upgradeCost(id, freeUsed);
    if (getShop().tokens < cost || purchased.includes(id)) return;
    addTokens(-cost); onBuy(id); sfx.menuConfirm();
  };
  return <div className="merchant-overlay" role="dialog" aria-label="Receptionist upgrades" aria-modal="true">
    {phase === "comic" ? <div className="merchant-comic">
      <img src={comic.url} alt="The tutorial of madness" />
      <Button className="mayhem-menu-button" onClick={() => setPhase("thanks")} disabled={paused}>CONTINUE</Button>
    </div> : phase === "shop" ? <div className="merchant-stall">
      <div className="merchant-bubbles" aria-hidden="true">{Array.from({ length: 14 }, (_, i) =>
        <span key={i} style={{ left: `${(i * 37) % 100}%`, width: 14 + (i * 7) % 34, height: 14 + (i * 7) % 34, animationDelay: `${-(i * 1.3) % 9}s`, animationDuration: `${7 + (i % 5)}s` }} />)}</div>
      <img className="merchant-stall-portrait" src={shopPortrait.url} alt="The Receptionist" draggable={false} />
      <section className="merchant-shop">
      <header className="merchant-header"><span className="merchant-tab font-pixel">SHOP</span><p>{freeUsed ? `${getShop().tokens} T` : `FIRST ONE’S ON ME · ${getShop().tokens} T`}</p>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close shop" title="Close shop" disabled={paused}><X /></Button></header>
      <div className="merchant-items">{MERCHANT_UPGRADES.map((item) => {
        const owned = purchased.includes(item.id);
        const cost = upgradeCost(item.id, freeUsed);
        return <article className="merchant-item" key={item.id}><ShoppingBag aria-hidden="true" /><h3>{item.name}</h3><p>{item.description}</p>
          <Button className="merchant-buy" disabled={paused || owned || item.unavailable || getShop().tokens < cost} onClick={() => buy(item.id)}>
            {item.unavailable ? "AWAITING SPRITES" : owned ? "READY THIS NIGHT" : cost === 0 ? "TAKE FREE" : `${cost} T`}
          </Button></article>;
      })}</div>
    </section></div> : <><img className="merchant-portrait" src={expression.url} alt="The Receptionist" draggable={false} />
      {phase !== "bag" && !paused && <div className="merchant-dialogue"><DialogueBox key={phase} allowSkip={false} onLineChange={setLineIndex}
        script={MERCHANT_DIALOGUE[phase === "intro" ? 0 : phase === "thanks" ? 1 : 2]}
        onDone={() => { setLineIndex(0); phase === "intro" ? setPhase("comic") : phase === "thanks" ? setPhase("bag") : openShop(); }} /></div>}
    </>}
  </div>;
}