// MAYHEM "AI MODE" art set.
//
// A complete alternate look for the night: every room, camera feed, health
// pack, control unit, and terminal screen is generated art / drawn in the DOM
// instead of the hand-made sprites. Toggled from the MAYHEM settings.
import aiOffice from "@/assets/mayhem/ai/AI_OFFICE.jpg";
import aiOfficeMeow from "@/assets/mayhem/ai/AI_OFFICE_MEOW.jpg";
import aiDoor from "@/assets/mayhem/ai/AI_DOOR.jpg";
import aiKeyhole from "@/assets/mayhem/ai/AI_KEYHOLE.jpg";
import aiHallway from "@/assets/mayhem/ai/AI_HALLWAY.jpg";
import aiStorage from "@/assets/mayhem/ai/AI_STORAGE.jpg";
import aiStorageUsed from "@/assets/mayhem/ai/AI_STORAGE_USED.jpg";
import aiCam1 from "@/assets/mayhem/ai/AI_CAM_1.jpg";
import aiCam2 from "@/assets/mayhem/ai/AI_CAM_2.jpg";
import aiCam3 from "@/assets/mayhem/ai/AI_CAM_3.jpg";
import aiCam4 from "@/assets/mayhem/ai/AI_CAM_4.jpg";
import aiCam5 from "@/assets/mayhem/ai/AI_CAM_5.jpg";

export const AI_ROOMS = {
  office: aiOffice,
  officeMeow: aiOfficeMeow,
  door: aiDoor,
  keyhole: aiKeyhole,
  hallway: aiHallway,
  storage: aiStorage,
  storageUsed: aiStorageUsed,
};

export const AI_CAM_FEEDS = [aiCam1, aiCam2, aiCam3, aiCam4, aiCam5];

/** Hotspots differ between the two art sets, so they travel with the art. */
export const AI_HOTSPOTS = {
  monitor: { left: "40%", top: "36%", width: "21%", height: "31%" },
  redGuy: { left: "66%", top: "59%", width: "11%", height: "14%" },
  healthPack: { left: "56%", top: "43%", width: "20%", height: "25%" },
};

export const AI_ASSET_URLS = [...Object.values(AI_ROOMS), ...AI_CAM_FEEDS];
