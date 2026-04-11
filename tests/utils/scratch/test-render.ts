import fs from "fs";
import { renderCcmChartPng } from "../../../src/utils/ccm-chart-png.js";

const W = 800;
const H = 450;

const barData = renderCcmChartPng(
  {
    kind: "bar",
    title: "AWS S3 Cost by Region",
    y_label: "Cost (USD)",
    points: [
      { label: "us-east-1", value: 1205.50 },
      { label: "eu-west-1", value: 890.20 },
      { label: "ap-south-1", value: 450.75 },
      { label: "us-west-2", value: 320.10 },
      { label: "sa-east-1", value: 150.00 }
    ],
  },
  { width: W, height: H },
);
fs.writeFileSync("tests/utils/scratch/bar.png", barData);

const lineData = renderCcmChartPng(
  {
    kind: "line",
    title: "Daily Cloud Compute Spend",
    y_label: "Spend (USD)",
    points: [
      { label: "2023-11-01", value: 50 },
      { label: "2023-11-02", value: 80 },
      { label: "2023-11-03", value: 120 },
      { label: "2023-11-04", value: 300 },
      { label: "2023-11-05", value: 250 },
      { label: "2023-11-06", value: 280 },
      { label: "2023-11-07", value: 310 },
    ],
  },
  { width: W, height: H },
);
fs.writeFileSync("tests/utils/scratch/line.png", lineData);

const groupedData = renderCcmChartPng(
  {
    kind: "grouped_bar",
    title: "Quarterly Compute Comparison",
    y_label: "Cost (USD)",
    series: [
      { key: "q1", label: "Q1", color: "#6366f1" },
      { key: "q2", label: "Q2", color: "#ec4899" },
    ],
    points: [
      { label: "Region A", values: { q1: 1000, q2: 1200 } },
      { label: "Region B", values: { q1: 500, q2: 800 } },
      { label: "Region C", values: { q1: 2000, q2: 1500 } },
    ],
  },
  { width: W, height: H },
);
fs.writeFileSync("tests/utils/scratch/grouped.png", groupedData);

console.log("Written test PNGs");
