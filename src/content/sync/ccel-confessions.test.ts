import { describe, expect, it } from "vitest";

import {
  normalizeParagraphText,
  parseCcelConfessionSource,
  parseLbcfChapter,
  parseWestminster3Chapter,
  parseWestminster3StandardChapter,
} from "./ccel-confessions.js";

describe("parseCcelConfessionSource", () => {
  it("accepts known CCEL kinds", () => {
    expect(parseCcelConfessionSource("ccel:westminster3")).toEqual({
      kind: "westminster3",
    });
    expect(parseCcelConfessionSource("ccel:lbcf")).toEqual({ kind: "lbcf" });
  });

  it("rejects unknown sources", () => {
    expect(parseCcelConfessionSource("https://example.com")).toMatchObject({
      error: expect.stringContaining("Expected ccel:"),
    });
  });
});

describe("parseWestminster3Chapter", () => {
  it("extracts numbered paragraphs and resolves variants", () => {
    const html = `
      <div class="book-content">
        <h1 id="i.i-p2.2">Of the Holy Scripture</h1>
        <p id="i.i-p3">1. yet [PCUS are they] [UPCUSA they are] not sufficient;</p>
        <p class="Continue" id="i.i-p5">Genesis</p>
        <p id="i.i-p72">3.The books commonly called Apocrypha,</p>
      </div>
      <table class="book_navbar_bottom"></table>
    `;

    const { chapterTitle, paragraphs } = parseWestminster3Chapter(1, html);

    expect(chapterTitle).toBe("Of the Holy Scripture");
    expect(paragraphs.get(1)).toBe("yet they are not sufficient;");
    expect(paragraphs.get(3)).toBe("The books commonly called Apocrypha,");
    expect(paragraphs.has(2)).toBe(false);
  });

  it("includes book lists and trailing continuation paragraphs", () => {
    const html = `
      <div class="book-content">
        <h1>Of the Holy Scripture</h1>
        <p id="i.i-p4">2. Under the name of Holy Scripture, which are these: </p>
        <table>
          <tr><th colspan="3"><b>Of the Old Testament</b></th></tr>
          <tr>
            <td><p class="Continue">Genesis</p><p class="Continue">Exodus</p></td>
          </tr>
          <tr><th colspan="3"><b>Of the New Testament</b></th></tr>
          <tr>
            <td><p class="Continue">Matthew</p><p class="Continue">Mark</p></td>
          </tr>
        </table>
        <p id="i.i-p71">All which are given by inspiration of God, to be the rule of faith and life. </p>
        <p id="i.i-p72">3. The books commonly called Apocrypha,</p>
      </div>
      <table class="book_navbar_bottom"></table>
    `;

    const { paragraphs } = parseWestminster3Chapter(1, html);

    expect(paragraphs.get(2)).toBe(
      "Under the name of Holy Scripture, which are these: Of the Old Testament: Genesis, Exodus; Of the New Testament: Matthew, Mark; All which are given by inspiration of God, to be the rule of faith and life.",
    );
  });

  it("renumbers duplicate paragraph labels within a chapter", () => {
    const html = `
      <div class="book-content">
        <h1>Of the Law of God</h1>
        <p>6. Although true believers be not under the law as a covenant of works.</p>
        <p>6. Neither are the forementioned uses of the law contrary to the grace of the gospel.</p>
      </div>
      <table class="book_navbar_bottom"></table>
    `;

    const { paragraphs } = parseWestminster3Chapter(19, html);

    expect(paragraphs.get(6)).toBe(
      "Although true believers be not under the law as a covenant of works.",
    );
    expect(paragraphs.get(7)).toBe(
      "Neither are the forementioned uses of the law contrary to the grace of the gospel.",
    );
  });
});

describe("parseWestminster3StandardChapter", () => {
  it("maps early chapters directly from the navbar title", () => {
    const html = `<table class="book_navbar"><td class="book_navbar_title">Chapter 3</td></table>`;
    expect(parseWestminster3StandardChapter(html)).toBe(3);
  });

  it("maps later chapters to standard WCF numbering", () => {
    const html = `<table class="book_navbar"><td class="book_navbar_title">Chapter 13 (11)</td></table>`;
    expect(parseWestminster3StandardChapter(html)).toBe(11);
  });

  it("skips UPCUSA-only and revised marriage chapters", () => {
    expect(
      parseWestminster3StandardChapter(
        `<td class="book_navbar_title">Chapter 9 (34)</td>`,
      ),
    ).toBeNull();
    expect(
      parseWestminster3StandardChapter(
        `<td class="book_navbar_title">Chapter 24: UPCUSA</td>`,
      ),
    ).toBeNull();
  });
});

describe("parseLbcfChapter", () => {
  it("extracts numbered paragraphs without scripture refs", () => {
    const html = `
      <BODY>
        <H1 ALIGN=CENTER>Of the Holy Scriptures.</H1>
        <P><A NAME="c1.1"></A>1. The Holy Scripture is the only sufficient,
        certain, and infallible <I><A HREF="scric01.htm#1.1">(a)</A></I> rule.</P>
        <DL><DD><A HREF="scric01.htm#1.1">a 2 Tim. 3:16</A></DD></DL>
        <P><A NAME="c1.2"></A>2. Under the Name of Holy Scripture</P>
      </BODY>
    `;

    const { chapterTitle, paragraphs } = parseLbcfChapter(1, html);

    expect(chapterTitle).toBe("Of the Holy Scriptures.");
    expect(paragraphs.get(1)).toBe(
      "The Holy Scripture is the only sufficient, certain, and infallible rule.",
    );
    expect(paragraphs.get(2)).toBe("Under the Name of Holy Scripture");
  });

  it("handles comma numbering and definition-list paragraphs", () => {
    const html = `
      <BODY>
        <H1>Of Baptism and the Lords Supper.</H1>
        <P><A NAME="c28.1"></A>1. Baptism and the Lords Supper are ordinances.</P>
        <DD><A HREF="scric28.htm#28.1">a Mat. 28 19,20.</A></DD>
        <DT><A NAME="c28.2"></A>2, These holy appointments are to be administred
        by those only, who are qualified <I><A HREF="scric28.htm#28.2">(b)</A></I>
        to the commission of Christ.</DT>
        <DD><A HREF="scric28.htm#28.2">b Mat. 28.19.</A></DD>
      </BODY>
    `;

    const { paragraphs } = parseLbcfChapter(28, html);

    expect(paragraphs.get(2)).toBe(
      "These holy appointments are to be administred by those only, who are qualified to the commission of Christ.",
    );
  });

  it("includes book lists and continuation definition-list paragraphs", () => {
    const html = `
      <BODY>
        <H1>Of the Holy Scriptures.</H1>
        <P><A NAME="c1.2"></A>2. Under the Name of Holy Scripture which are these,</P>
        <P>Of the Old Testament.</P>
        <P>Genesis, Exodus, Leviticus.</P>
        <P>Of the new Testament.</P>
        <DL>
        <DT>Matthew, Mark, Luke. All which are given by the inspiration of God, to be the rule of Faith and Life.</DT>
        <DD><A HREF="scric01.htm#1.5">e 2 Tim. 3. 16.</A></DD>
        <DT><A NAME="c1.3"></A>3. The Books commonly called Apocrypha</DT>
        </DL>
      </BODY>
    `;

    const { paragraphs } = parseLbcfChapter(1, html);

    expect(paragraphs.get(2)).toBe(
      "Under the Name of Holy Scripture which are these, Of the Old Testament. Genesis, Exodus, Leviticus. Of the new Testament. Matthew, Mark, Luke. All which are given by the inspiration of God, to be the rule of Faith and Life.",
    );
    expect(paragraphs.get(3)).toBe("The Books commonly called Apocrypha");
  });

  it("includes definition-list continuations after paragraph tags", () => {
    const html = `
      <BODY>
        <H1>Of the Holy Scriptures.</H1>
        <P><A NAME="c1.6"></A>6. The whole Councel of God is in the Holy Scripture; unto which nothing is to be added.</P>
        <DL>
        <DT>Nevertheless we acknowledge the inward illumination of the Spirit of God, to be necessary for the saving understanding of such things as are revealed in the Word.</DT>
        <DD><A HREF="scric01.htm#1.9">i 2 Tim. 3. 15.</A></DD>
        <DT><A NAME="c1.7"></A>7. All things in Scripture are not alike plain.</DT>
        </DL>
      </BODY>
    `;

    const { paragraphs } = parseLbcfChapter(1, html);

    expect(paragraphs.get(6)).toBe(
      "The whole Councel of God is in the Holy Scripture; unto which nothing is to be added. Nevertheless we acknowledge the inward illumination of the Spirit of God, to be necessary for the saving understanding of such things as are revealed in the Word.",
    );
  });
});

describe("normalizeParagraphText", () => {
  it("decodes entities and collapses whitespace", () => {
    expect(normalizeParagraphText("God&#39;s word")).toBe("God's word");
  });
});
