import { describe, expect, it } from "vitest";
import { groupResources } from "./resourceGroups";

const machines = [
  { name: "Rachel", resourceId: "1", stripeKey: "3d_printer", unavailableIntervals: [] },
  { name: "Phoebe", resourceId: "2", stripeKey: "3d_printer", unavailableIntervals: [{ reservationId: 20 }] },
  { name: "Monica", resourceId: "3", stripeKey: "3d_printer", unavailableIntervals: [] },
  { name: "Darth Vader", resourceId: "4", stripeKey: "laser", unavailableIntervals: [] },
  { name: "Kirk", resourceId: "5", stripeKey: "metal_lathe", unavailableIntervals: [] },
  { name: "Spock", resourceId: "6", stripeKey: "wood_lathe", unavailableIntervals: [] },
  { name: "Joey", resourceId: "7", stripeKey: "large_cnc", unavailableIntervals: [] },
  { name: "Ross", resourceId: "8", stripeKey: "small_cnc", unavailableIntervals: [] },
  { name: "Chandler", resourceId: "9", stripeKey: "small_cnc", unavailableIntervals: [] },
];

const studios = [
  ["Harkonnen", "small maker studio"],
  ["Atreides", "small maker studio"],
  ["Corrine", "small maker studio"],
  ["Coruscant", "med maker studio"],
  ["Alderaan", "med maker studio"],
  ["Corellia", "med maker studio"],
  ["Paris", "large maker studio"],
  ["Big Apple", "large maker studio"],
].map(([name, description], index) => ({ name, description, resourceId: `studio-${index}`, unavailableIntervals: [] }));

describe("named machine resource groups", () => {
  it("shows one card per equipment type and keeps each machine's identity and availability", () => {
    const groups = groupResources(machines);
    expect(groups.map((group) => group.name)).toEqual([
      "3D Printer", "Darth Vader", "Kirk", "Spock", "Joey", "Small CNC",
    ]);
    const printers = groups[0];
    expect(printers.alternatives.map((machine) => machine.displayName)).toEqual(["Rachel", "Phoebe", "Monica"]);
    expect(printers.alternatives.map((machine) => machine.resourceId)).toEqual(["1", "2", "3"]);
    expect(printers.alternatives[1].unavailableIntervals).toEqual([{ reservationId: 20 }]);
    expect(groups.find((group) => group.name === "Darth Vader").resourceId).toBe("4");
    expect(groups.find((group) => group.name === "Ross" || group.name === "Small CNC").alternatives.map((machine) => machine.displayName)).toEqual(["Ross", "Chandler"]);
  });

  it("groups small, medium, and large maker studios with the requested names", () => {
    const groups = groupResources(studios);
    expect(groups.map(({ name, alternatives }) => [name, alternatives.map(({ displayName }) => displayName)])).toEqual([
      ["Small Maker Studio", ["Harkonnen", "Atreides", "Corrine"]],
      ["Medium Maker Studio", ["Coruscant", "Alderaan", "Corellia"]],
      ["Large Maker Studio", ["Paris", "Big Apple"]],
    ]);
  });

  it("does not merge unrelated resources just because they share a type label", () => {
    const groups = groupResources([
      { name: "Other Machine", description: "CNC", resourceId: "10" },
      { name: "Another Machine", description: "CNC", resourceId: "11" },
    ]);
    expect(groups.map(({ resourceId, alternatives }) => [resourceId, alternatives])).toEqual([["10", undefined], ["11", undefined]]);
  });
});
