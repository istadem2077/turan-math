import { describe, expect, it } from "vitest";
import { missingContext } from "./question-checks";

describe("missingContext", () => {
  it("flags 'defined above' with nothing above", () => {
    expect(missingContext("For the function f defined above, what is the value of $f(-1)$?")).toMatch(/above/);
  });
  it("accepts 'defined above' after a display equation", () => {
    expect(missingContext("$$f(x)=4x-3$$\n\nFor the function f defined above, what is the value of $f(-1)$?")).toBeNull();
  });
  it("accepts 'above' after an inline definition", () => {
    expect(missingContext("The function $f$ is defined by $f(x)=4x-3$. For the function above, what is $f(2)$?")).toBeNull();
  });
  it("flags a missing figure, and accepts one that is there", () => {
    expect(missingContext("In the figure, what is the value of $x$?")).toMatch(/figure/);
    expect(missingContext("![Triangle](/api/assets/abc)\n\nIn the figure, what is the value of $x$?")).toBeNull();
  });
  it("flags a missing graph", () => {
    expect(missingContext("The graph of $y=f(x)$ is shown. What is $f(0)$?")).toMatch(/graph/);
  });
  it("flags a missing table, accepts a Markdown table", () => {
    expect(missingContext("Based on the table, how many students chose art?")).toMatch(/table/);
    expect(missingContext("| a | b |\n| --- | --- |\n| 1 | 2 |\n\nBased on the table, what is $a$?")).toBeNull();
  });
  it("leaves ordinary questions alone", () => {
    expect(missingContext("If $3x+5=20$, what is the value of $x$?")).toBeNull();
    expect(missingContext("What is the graph of $y=2x$ in the xy-plane?".replace("the graph of", "the slope of"))).toBeNull();
  });
});
