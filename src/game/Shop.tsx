import { useEffect, useState } from "react";
import { sfx } from "@/game/sfx";
import CheatMenu from "@/game/CheatMenu";
import {
  ABILITIES, BEAM_SKINS, MAX_ABILITY_SLOTS,
  activeBeamSkin, buy, equipBeamSkin, getShop, hasAbility, isOwned,
  subscribeShop, toggleAbility,
} from "@/game/shop";

type ShopTab = "beams" | "abilities" | "cheats" | "more";

export default function Shop({ onClose }: { onClose: () => void }) {
  const [, force] = useState(0);
  const [tab, setTab] = useState<ShopTab>("beams");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => subscribeShop(() => force((n) => n + 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(null), 1600);
    return () => window.clearTimeout(id);
  }, [note]);

  const shop = getShop();
  const skin = activeBeamSkin();

  const tryBuy = (id: string, price: number, label: string) => {
    if (buy(id, price)) {
      sfx.menuConfirm();
      setNote(`BOUGHT ${label}`);
    } else {
      sfx.menuBack();
      setNote("NOT ENOUGH TOKENS");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#120014] text-[#f6efe6] overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-[#ffe23a]/70 px-5 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-bungee text-3xl md:text-4xl text-[#ffe23a] -rotate-1">THE SHOP</h1>
          <span className="font-marker text-xs text-[#f6efe6]/60 hidden sm:inline">spend it or stare at it</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="scribble-border bg-[#1e0020] px-4 py-2 font-bungee text-xl text-[#ffe23a]">
            {shop.tokens} <span className="text-[#f6efe6]">T</span>
          </div>
          <button
            type="button"
            onClick={() => { sfx.menuBack(); onClose(); }}
            className="scribble-border bg-[#f6efe6] px-4 py-2 font-bungee text-[#1a1a1a] hover:scale-105 transition-transform"
          >
            CLOSE
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-2 px-5 pt-4 flex-wrap">
        <ShopTabBtn active={tab === "beams"} onClick={() => setTab("beams")}>BEAM SKINS</ShopTabBtn>
        <ShopTabBtn active={tab === "abilities"} onClick={() => setTab("abilities")}>SV ABILITIES</ShopTabBtn>
        <ShopTabBtn active={tab === "cheats"} onClick={() => setTab("cheats")}>CHEATS</ShopTabBtn>
        <ShopTabBtn active={tab === "more"} onClick={() => setTab("more")}>MORE...</ShopTabBtn>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {tab === "beams" && (
          <>
            <p className="font-marker text-sm text-[#f6efe6]/70 mb-4">
              Equipped beam: <span className="text-[#ffe23a]">{skin.name}</span> — used in Star Vanisher...!!
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {BEAM_SKINS.map((s) => {
                const owned = isOwned(s.id);
                const equipped = shop.beamSkin === s.id;
                return (
                  <div
                    key={s.id}
                    className="scribble-border bg-[#1e0020] p-3 flex flex-col gap-3"
                    style={{ borderColor: equipped ? "#ffe23a" : undefined }}
                  >
                    <div className="relative h-16 overflow-hidden bg-[#2a0011]">
                      <div
                        className="absolute left-0 top-1/2 h-6 w-full -translate-y-1/2"
                        style={{ background: `linear-gradient(90deg, ${s.core}, ${s.edge})` }}
                      />
                      <div
                        className="absolute left-0 top-1/2 h-2 w-full -translate-y-1/2"
                        style={{ background: s.core }}
                      />
                      <div
                        className="absolute right-2 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full"
                        style={{ background: s.accent, opacity: 0.8 }}
                      />
                    </div>
                    <div>
                      <div className="font-bungee text-lg text-[#f6efe6]">{s.name}</div>
                      <p className="font-marker text-xs text-[#f6efe6]/70">{s.desc}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <span className="font-bungee text-sm text-[#ffe23a]">
                        {owned ? "OWNED" : `${s.price} T`}
                      </span>
                      {owned ? (
                        <button
                          type="button"
                          disabled={equipped}
                          onClick={() => { equipBeamSkin(s.id); sfx.menuConfirm(); }}
                          className="scribble-border bg-[#f6efe6] px-3 py-1.5 font-bungee text-xs text-[#1a1a1a] disabled:opacity-50 hover:scale-105 transition-transform"
                        >
                          {equipped ? "EQUIPPED" : "EQUIP"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => tryBuy(s.id, s.price, s.name)}
                          className="scribble-border bg-[#ffe23a] px-3 py-1.5 font-bungee text-xs text-[#1a1a1a] hover:scale-105 transition-transform"
                        >
                          BUY
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "abilities" && (
          <>
            <p className="font-marker text-sm text-[#f6efe6]/70 mb-4">
              Star Vanisher abilities — equip up to {MAX_ABILITY_SLOTS} at a time.
              Active: <span className="text-[#ffe23a]">{shop.abilities.length}/{MAX_ABILITY_SLOTS}</span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ABILITIES.map((a) => {
                const owned = isOwned(a.id);
                const on = hasAbility(a.id);
                return (
                  <div
                    key={a.id}
                    className="scribble-border bg-[#1e0020] p-4 flex flex-col gap-3"
                    style={{ borderColor: on ? "#8bff3a" : undefined }}
                  >
                    <div>
                      <div className="font-bungee text-lg text-[#f6efe6]">{a.name}</div>
                      <p className="font-marker text-xs text-[#f6efe6]/70 mt-1">{a.desc}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <span className="font-bungee text-sm text-[#ffe23a]">
                        {owned ? (on ? "ACTIVE" : "OWNED") : `${a.price} T`}
                      </span>
                      {owned ? (
                        <button
                          type="button"
                          onClick={() => { toggleAbility(a.id); sfx.menuHover(); }}
                          className="scribble-border bg-[#f6efe6] px-3 py-1.5 font-bungee text-xs text-[#1a1a1a] hover:scale-105 transition-transform"
                        >
                          {on ? "UNEQUIP" : "EQUIP"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => tryBuy(a.id, a.price, a.name)}
                          className="scribble-border bg-[#ffe23a] px-3 py-1.5 font-bungee text-xs text-[#1a1a1a] hover:scale-105 transition-transform"
                        >
                          BUY
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "cheats" && <CheatMenu />}

        {tab === "more" && (
          <div className="scribble-border bg-[#1e0020] p-8 text-center">
            <div className="font-bungee text-2xl text-[#ffe23a]">C O M I N G   S O O N .</div>
            <p className="font-marker text-sm text-[#f6efe6]/70 mt-3">
              Character skins, trails, taunts and whatever else gets cooked up. Keep grinding tokens.
            </p>
          </div>
        )}
      </div>

      <div className="border-t-4 border-[#ffe23a]/40 px-5 py-3 font-marker text-xs text-[#f6efe6]/60">
        Tokens (T) come from Star Vanisher...!! runs — 100 points = 1 T.
      </div>

      {note && (
        <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 scribble-border bg-[#f6efe6] px-4 py-2 font-bungee text-sm text-[#1a1a1a]">
          {note}
        </div>
      )}
    </div>
  );
}

function ShopTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`scribble-border px-4 py-2 font-bungee text-xs transition-transform hover:scale-105 ${
        active ? "bg-[#ffe23a] text-[#1a1a1a]" : "bg-[#1e0020] text-[#f6efe6]/80"
      }`}
    >
      {children}
    </button>
  );
}
