import { describe, expect, it } from "vitest";

import {
  cleanUsfmText,
  parseUsfmLayout,
} from "./usfm-poetry-parser.js";

const PSALM_1_SNIPPET = String.raw`\id PSA World English Bible Protestant
\c 1
\q1
\v 1 Blessed \w is|strong="H7563"\w* the man who doesn't walk in the counsel of the wicked,
\q2 nor stand on the path of sinners,
\q2 nor sit in the seat of scoffers;
\q1
\v 2 but his delight is in the LORD's law.
\q2 On his law he meditates day and night.
\b
\q1
\v 3 He will be like a tree planted by the streams of water,
\q2 that produces its fruit in its season,
\q2 whose leaf also does not wither.
\q2 Whatever he does shall prosper.
\q1
\v 4 The wicked are not so,
\q2 but are like the chaff which the wind drives away.
`;

const GENESIS_1_SNIPPET = String.raw`\id GEN World English Bible
\c 1
\p
\v 1 In the beginning, God created the heavens and the earth.
\v 2 The earth was formless and empty.
\p
\v 3 God said, "Let there be light," and there was light.
\v 4 God saw the light, and saw that it was good.
`;

describe("cleanUsfmText", () => {
  it("strips word markers and footnotes", () => {
    expect(
      cleanUsfmText(String.raw`\w LORD|strong="H3068"\w*'s\f + \fr 1:2 \ft note\f* law.`),
    ).toBe("LORD's law.");
  });
});

describe("parseUsfmLayout", () => {
  it("parses psalm poetry lines with indents", () => {
    const index = parseUsfmLayout(PSALM_1_SNIPPET, "ps");

    expect(index["ps.1.1"]?.lines).toEqual([
      {
        indent: 1,
        text: "Blessed is the man who doesn't walk in the counsel of the wicked,",
      },
      { indent: 2, text: "nor stand on the path of sinners," },
      { indent: 2, text: "nor sit in the seat of scoffers;" },
    ]);

    expect(index["ps.1.2"]?.lines).toEqual([
      { indent: 1, text: "but his delight is in the LORD's law." },
      { indent: 2, text: "On his law he meditates day and night." },
    ]);

    expect(index["ps.1.2"]?.stanzaBreakAfter).toBe(true);
    expect(index["ps.1.4"]?.lines).toHaveLength(2);
  });

  it("parses prose paragraph breaks", () => {
    const index = parseUsfmLayout(GENESIS_1_SNIPPET, "gen");

    expect(index["gen.1.1"]?.paragraphBreakBefore).toBe(true);
    expect(index["gen.1.1"]?.lines[0]?.text).toContain("In the beginning");
    expect(index["gen.1.2"]?.paragraphBreakBefore).toBeUndefined();
    expect(index["gen.1.3"]?.paragraphBreakBefore).toBe(true);
    expect(index["gen.1.4"]?.paragraphBreakBefore).toBeUndefined();
  });
});
