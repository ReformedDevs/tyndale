import { VerseLookup } from "../citations/bible/lookup.js";
import { ConfessionLookup } from "../citations/confessions/lookup.js";

VerseLookup.fromIndexes({
  web: {},
  asv: {},
  ylt: {},
  kjv: {},
  geneva: {},
  tyndale: {},
  wyc: {},
});

ConfessionLookup.fromDocuments({
  wcf: {
    meta: {
      id: "wcf",
      kind: "confession",
      abbrev: "WCF",
      title: "Westminster Confession of Faith",
    },
    chapters: [],
  },
  lbcf: {
    meta: {
      id: "lbcf",
      kind: "confession",
      abbrev: "LBCF",
      title: "1689 London Baptist Confession",
    },
    chapters: [],
  },
});
