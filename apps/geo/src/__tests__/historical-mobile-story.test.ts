import { describe, expect, it } from "bun:test";
import {
  buildChangeSummary,
  buildFlowBriefSummary,
  buildFlowStoryEvents,
  buildTimelineBriefSummary,
  describeChangeAction,
  formatNameList,
  timelineStepYear,
} from "../lib/historical-mobile-story";
import { buildAncestryFlow, buildForwardFlow } from "../lib/historical-flow";

describe("historical mobile story helpers", () => {
  it("formatNameList joins Norwegian lists", () => {
    expect(formatNameList(["Borre"])).toBe("Borre");
    expect(formatNameList(["Borre", "Åsgårdstrand"])).toBe(
      "Borre og Åsgårdstrand",
    );
    expect(formatNameList(["A", "B", "C"])).toBe("A, B og C");
    expect(formatNameList(["A", "A", "B"])).toBe("A og B");
  });

  it("buildChangeSummary describes merges in plain language", () => {
    expect(
      buildChangeSummary("merged", ["Borre", "Åsgårdstrand"], ["Borre"]),
    ).toBe("Borre og Åsgårdstrand ble slått sammen til Borre.");
    expect(buildChangeSummary("incorporated", ["Klæbu"], ["Trondheim"])).toBe(
      "Klæbu ble innlemmet i Trondheim.",
    );
    expect(buildChangeSummary("renamed", ["Aker"], ["Oslo"])).toBe(
      "Aker fikk nytt navn: Oslo.",
    );
  });

  it("describeChangeAction returns mobile-friendly labels", () => {
    expect(describeChangeAction("merged")).toBe("Opphørte ved sammenslåing");
    expect(describeChangeAction("renumbered")).toBe("Fikk nytt nummer");
    expect(describeChangeAction(undefined)).toBeUndefined();
  });

  it("timelineStepYear prefers end year for historical steps", () => {
    expect(
      timelineStepYear({
        name: "Borre",
        validFrom: 1858,
        validTo: 1963,
        isCurrent: false,
      }),
    ).toBe("1963");
    expect(
      timelineStepYear({
        name: "Horten",
        isCurrent: true,
      }),
    ).toBe("I dag");
  });

  it("buildTimelineBriefSummary composes a readable summary", () => {
    const summary = buildTimelineBriefSummary(
      [
        {
          name: "Borre",
          validFrom: 1858,
          validTo: 1963,
          changeType: "merged",
          isCurrent: false,
        },
        {
          name: "Horten",
          isCurrent: true,
        },
      ],
      "kommune",
    );
    expect(summary).toContain("opprettet i 1858");
    expect(summary).toContain("Horten");
  });

  it("buildFlowStoryEvents replaces step labels with event headings", async () => {
    const flow = await buildAncestryFlow("39", "county");
    const events = buildFlowStoryEvents(flow);

    expect(events.length).toBeGreaterThan(1);
    expect(events.some((e) => e.heading.includes("Endring i"))).toBe(true);
    expect(events.every((e) => !e.heading.startsWith("Steg"))).toBe(true);
    expect(events.every((e) => e.summary.length > 0)).toBe(true);
  });

  it("buildFlowBriefSummary describes Borre to Horten lineage", async () => {
    const flow = await buildForwardFlow("hist-mun-0717-borre", "municipality");
    const summary = buildFlowBriefSummary(flow, "kommune");

    expect(summary).toBeTruthy();
    expect(summary).toContain("Horten");
  });
});
