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
    title: "Westminster Confession of Faith",
    abbrev: "WCF",
    entries: {},
  },
  lbcf: {
    title: "1689 London Baptist Confession",
    abbrev: "LBCF",
    entries: {},
  },
});
