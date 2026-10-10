import { expect, it } from "vitest";
import { getSelectedCharacter, isUnlocked, resetCharacterProgress, selectCharacter } from "./character";

it("Sir Wobble is playable without an unlock requirement", () => {
  resetCharacterProgress();
  expect(isUnlocked("wobble")).toBe(true);
  selectCharacter("wobble");
  expect(getSelectedCharacter()).toBe("wobble");
  resetCharacterProgress();
});