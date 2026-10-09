import { MAYHEM_VOICE, type DialogueScript } from "./dialogue";
import neutral from "@/assets/mayhem/receptionist/The_Receptionist_Neutral_dialouge.png.asset.json";
import neutral2 from "@/assets/mayhem/receptionist/The_Receptionist_Neutral_2_dialouge.png.asset.json";
import surprised from "@/assets/mayhem/receptionist/The_Receptionist_surprised_dialouge.png.asset.json";

import unsurprised from "@/assets/mayhem/receptionist/The_Receptionist_Unsurprised_dialouge.png.asset.json";
import realise from "@/assets/mayhem/receptionist/The_Receptionist_Realise_dialouge.png.asset.json";
import bag from "@/assets/mayhem/receptionist/The_Receptionist_Bag_dialouge_l.png.asset.json";
import greet from "@/assets/mayhem/receptionist/Recep_Greet_Dialouge.png.asset.json";
import question from "@/assets/mayhem/receptionist/Recep_Worry_or_Question_Dialouge.png.asset.json";
import paper from "@/assets/mayhem/receptionist/The_Receptionist_Paper_Give_dialouge.png.asset.json";
import shopUi from "@/assets/mayhem/receptionist/Recep_Shop_UI_Dialouge.png.asset.json";

export const MERCHANT_EXPRESSIONS = {
  intro: [greet, greet, question, question, neutral2, surprised, unsurprised, unsurprised, paper, paper],
  thanks: [neutral, neutral2, realise],
  offer: [shopUi, shopUi],
  bag,
};
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
  { id: "merchant-before-bag", lines: [you("Ya know what? This could be real useful, thanks a ton!"), rec("Im glad i can help, now for the way i can help.."), rec("Oh i know!")] },
  { id: "merchant-before-shop", lines: [rec("i do have these upgrades for your devices, kind alike that slow generator. Say, first one is free, on me, second time you are gunna pay my friend!"), you("Fairs.")] },
];