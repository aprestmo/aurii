import { describe, expect, it } from "bun:test";
import {
  buildAncestryFlow,
  buildForwardFlow,
  hasFlowContent,
} from "../lib/historical-flow";

describe("historical administrative flow diagrams", () => {
  it("Trondheim ancestry includes Klæbu (2018)", async () => {
    const flow = await buildAncestryFlow("5001", "municipality");
    expect(hasFlowContent(flow)).toBe(true);
    const names = flow.nodes.map((n) => n.name);
    expect(names).toContain("Trondheim");
    expect(names).toContain("Klæbu");
  });

  it("Trøndelag ancestry includes Nord-Trøndelag and Sør-Trøndelag", async () => {
    const flow = await buildAncestryFlow("50", "county");
    expect(hasFlowContent(flow)).toBe(true);
    const names = flow.nodes.map((n) => n.name);
    expect(names).toContain("Trøndelag");
    expect(names).toContain("Nord-Trøndelag");
    expect(names).toContain("Sør-Trøndelag");
    expect(flow.layers[0]?.length).toBeGreaterThanOrEqual(2);
  });

  it("Vestfold ancestry goes via Vestfold og Telemark", async () => {
    const flow = await buildAncestryFlow("39", "county");
    expect(hasFlowContent(flow)).toBe(true);
    const names = flow.nodes.map((n) => n.name);
    expect(names).toContain("Vestfold");
    expect(names).toContain("Vestfold og Telemark");
  });

  it("Austre Moland forward flow reaches Arendal", async () => {
    const flow = await buildForwardFlow(
      "hist-mun-0918-austre-moland",
      "municipality",
    );
    expect(hasFlowContent(flow)).toBe(true);
    const names = flow.nodes.map((n) => n.name);
    expect(names).toContain("Austre Moland");
    expect(names[names.length - 1]).toBe("Arendal");
  });

  it("Borre forward flow reaches Horten without hanging", async () => {
    const flow = await buildForwardFlow("hist-mun-0717-borre", "municipality");
    expect(hasFlowContent(flow)).toBe(true);
    const terminal = flow.nodes.find((n) => n.isCurrent);
    expect(terminal?.name).toBe("Horten");
    expect(flow.edges.every((edge) => edge.from !== edge.to)).toBe(true);
  });

  it("Nord-Trøndelag forward flow reaches Trøndelag", async () => {
    const flow = await buildForwardFlow(
      "hist-county-17-nord-trondelag",
      "county",
    );
    expect(hasFlowContent(flow)).toBe(true);
    const terminal = flow.nodes.find((n) => n.isCurrent);
    expect(terminal?.name).toBe("Trøndelag");
  });
});
