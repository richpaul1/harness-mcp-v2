import { describe, it, expect } from "vitest";
import { renderCcmChartPng } from "../../src/utils/ccm-chart-png.js";

describe("renderCcmChartPng", () => {
  it("returns a PNG buffer with signature", () => {
    const buf = renderCcmChartPng(
      {
        kind: "bar",
        title: "Unit test",
        points: [
          { label: "A", value: 10 },
          { label: "B", value: 20 },
        ],
      },
      { width: 640, height: 400 },
    );
    expect(buf.length).toBeGreaterThan(100);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  it("renders grouped_bar PNG", () => {
    const buf = renderCcmChartPng(
      {
        kind: "grouped_bar",
        title: "Grouped",
        y_label: "USD",
        series: [
          { key: "current", label: "Current", color: "#22c55e" },
          { key: "previous", label: "Previous", color: "#ef4444" },
        ],
        points: [
          { label: "East", values: { current: 100, previous: 90 } },
          { label: "West", values: { current: 50, previous: 55 } },
        ],
      },
      { width: 640, height: 400 },
    );
    expect(buf.length).toBeGreaterThan(100);
    expect(buf[0]).toBe(0x89);
  });
});
