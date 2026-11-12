import officeDeathAudio from "@/assets/mayhem/manager_office_death.mp3";
import officeDeathVideo from "@/assets/mayhem/manager_office_death.mp4";

export type OfficeDeathVideo = {
  video: string;
  audio: string;
};

export const OFFICE_DEATH_VIDEOS: OfficeDeathVideo[] = [
  { video: officeDeathVideo, audio: officeDeathAudio },
];

export function chooseOfficeDeathVideo(
  videos: readonly OfficeDeathVideo[],
  random = Math.random,
): OfficeDeathVideo {
  if (videos.length === 0) throw new Error("At least one office death video is required");
  return videos[Math.min(videos.length - 1, Math.floor(random() * videos.length))];
}
