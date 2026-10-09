import { MAYHEM_VOICE, type DialogueScript } from "./dialogue";
const rec = (text: string) => ({ speaker: "RECEPTIONIST", text, color: MAYHEM_VOICE.intercom });
const you = (text: string) => ({ speaker: "YOU", text, color: MAYHEM_VOICE.you });
export const MERCHANT_DIALOGUE: DialogueScript[] = [
  { id: "merchant-before-comic", lines: [
    rec("Hello again valued employee!"), you("Hello again.."), rec("Why the long look?"),
    you("Well, for one im tired, and 2… you wouldn’t believe me when i say this… but i saw some pink haired freak out the hallway.. She looked… s-she looked like she was studying me, for some reason.."),
    rec("I saw her as well one time, she also did the same with me, wrote down my every move, and she also had these.. Robotic assistants or whatev-"),
    you("W-WHAT!?!? R-R-ROBOT ASSISTANTS?!?!?"), rec("…"), rec("Yes.."),
    rec("anyway, i am not really able to help you while you are there but i CAN help you with some upgrades, and this paper i found, she dropped it by the way."), you("okay.."),
  ] },
  { id: "merchant-before-bag", lines: [you("Ya know what? This could be real useful, thanks a ton!"), rec("Im glad i can help, now for the way i can help.. Oh i know!")] },
  { id: "merchant-before-shop", lines: [rec("i do have these upgrades for your devices, kind alike that slow generator. Say, first one is free, on me, second time you are gunna pay my friend!"), you("Fairs.")] },
];