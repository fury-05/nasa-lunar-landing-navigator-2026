// LunarOps: Lunar Landing Site Navigator, 7 slide deck.
// Every number below comes from a file or the live API in this repository (see notes on each slide).
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const QRCode = require("qrcode");
const path = require("path");
const fa = require("react-icons/fa");

const REPO = "F:/PROJECTS/NASA-SPACE-Challeng-2026";
const SHOT = (f) => path.join(REPO, "docs", "demo-assets", f);

// ---------- palette: deep space + the app's own Sun amber and Earth blue ----------
const NAVY = "060B18"; // slide background
const PANEL = "0E1730"; // card
const PANEL2 = "142046"; // raised card
const INK = "EAF0FF"; // main text on dark
const MUTED = "9FB0D6"; // secondary text on dark
const SUN = "FFB454"; // accent 1
const EARTH = "5EA2FF"; // accent 2
const TEAL = "4FD1C5"; // good
const RED = "FF7A8A"; // problem
const LIGHT = "FFFFFF";

const FONT_H = "Cambria";
const FONT_B = "Calibri";

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

async function qr(url, dark, light) {
  const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 400, color: { dark: "#" + dark, light: "#" + light } });
  return dataUrl.replace("data:", "");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pres.author = "LunarOps";
  pres.company = "LunarOps";
  pres.title = "Lunar Landing Site Navigator";
  pres.subject = "NASA Space Apps Challenge 2026";

  const W = 13.33;
  const H = 7.5;
  const MX = 0.7;

  const bg = (s) => { s.background = { color: NAVY }; };

  const footer = (s, n) => {
    s.addText("LunarOps  |  Lunar Landing Site Navigator", { x: MX, y: 7.05, w: 7, h: 0.3, fontFace: FONT_B, fontSize: 10, color: MUTED, margin: 0, isTextBox: true, objectName: "Footer" });
    s.addText(`${n} / 7`, { x: W - MX - 1, y: 7.05, w: 1, h: 0.3, fontFace: FONT_B, fontSize: 10, color: MUTED, align: "right", margin: 0, isTextBox: true, objectName: "Page" });
  };

  const title = (s, text, kicker) => {
    if (kicker) s.addText(kicker, { x: MX, y: 0.42, w: 9, h: 0.3, fontFace: FONT_B, fontSize: 12, bold: true, color: SUN, charSpacing: 3, margin: 0, isTextBox: true, objectName: "Kicker" });
    s.addText(text, { x: MX, y: 0.75, w: W - 2 * MX, h: 0.8, fontFace: FONT_H, fontSize: 34, bold: true, color: INK, margin: 0, valign: "top", isTextBox: true, objectName: "Title" });
  };

  const card = (s, x, y, w, h, fill = PANEL) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: "22305F", width: 0.75 }, objectName: "Card" });
  };

  const iconDisc = async (s, Comp, x, y, d, color) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: PANEL2 }, line: { color: color, width: 1 }, objectName: "IconDisc" });
    const pad = d * 0.27;
    s.addImage({ data: await icon(Comp, color), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, altText: "icon" });
  };

  // =========================================================== 1  TITLE
  {
    const s = pres.addSlide(); bg(s);
    // sky motif: concentric polar rings (the app's sky chart) on the right
    const cx = 10.2, cy = 3.75;
    [3.0, 2.2, 1.4, 0.6].forEach((r, i) => {
      s.addShape(pres.shapes.OVAL, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { color: i === 0 ? "0A1430" : NAVY, transparency: i === 0 ? 0 : 100 }, line: { color: i === 0 ? "2A3A78" : "1D2A5C", width: 1, dashType: i === 0 ? "solid" : "dash" }, objectName: "Ring" + i });
    });
    // terrain silhouette cut: a dark crescent
    s.addShape(pres.shapes.OVAL, { x: cx - 1.25, y: cy - 1.0, w: 2.3, h: 2.9, fill: { color: "03060F" }, line: { color: "7C8DB8", width: 1.25 }, objectName: "Terrain" });
    // sun and earth discs
    s.addShape(pres.shapes.OVAL, { x: cx + 1.55, y: cy + 0.7, w: 0.42, h: 0.42, fill: { color: SUN }, line: { color: "FFF3D6", width: 1.5 }, objectName: "Sun" });
    s.addShape(pres.shapes.OVAL, { x: cx - 1.25, y: cy + 1.7, w: 0.32, h: 0.32, fill: { color: EARTH }, line: { color: "E8EEFC", width: 1.5 }, objectName: "Earth" });
    s.addText("N", { x: cx - 0.2, y: cy - 3.35, w: 0.4, h: 0.3, fontFace: FONT_B, fontSize: 12, color: MUTED, align: "center", margin: 0, isTextBox: true, objectName: "North" });

    s.addText("NASA SPACE APPS CHALLENGE 2026", { x: MX, y: 1.0, w: 7.5, h: 0.35, fontFace: FONT_B, fontSize: 13, bold: true, color: SUN, charSpacing: 4, margin: 0, isTextBox: true, objectName: "Event" });
    s.addText("Lunar Landing Site Navigator", { x: MX, y: 1.5, w: 7.2, h: 1.9, fontFace: FONT_H, fontSize: 48, bold: true, color: INK, margin: 0, valign: "top", isTextBox: true, objectName: "Title" });
    s.addText("Where and when can a lander see the Sun and the Earth at the Moon's south pole, once the real terrain is in the way?", { x: MX, y: 3.5, w: 6.7, h: 1.1, fontFace: FONT_B, fontSize: 18, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: "Tagline" });

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 5.0, w: 3.0, h: 0.62, rectRadius: 0.31, fill: { color: PANEL2 }, line: { color: SUN, width: 1.25 }, objectName: "TeamBadge" });
    s.addText([{ text: "Team  ", options: { color: MUTED } }, { text: "LunarOps", options: { color: SUN, bold: true } }], { x: MX, y: 5.0, w: 3.0, h: 0.62, align: "center", valign: "middle", fontFace: FONT_B, fontSize: 18, margin: 0, isTextBox: true, objectName: "TeamName" });

    s.addText("Irfan S. Mulla  |  Afreen Mulla  |  Luz Aponte", { x: MX, y: 5.9, w: 7, h: 0.35, fontFace: FONT_B, fontSize: 15, color: INK, margin: 0, isTextBox: true, objectName: "Names" });
    s.addText("Planning tool, not for flight operations", { x: MX, y: 6.45, w: 6, h: 0.3, fontFace: FONT_B, fontSize: 12, italic: true, color: MUTED, margin: 0, isTextBox: true, objectName: "Disclaimer" });
    s.addNotes("Introduce the team LunarOps and the challenge. One sentence: our tool compares south pole landing sites and dates by where the Sun and the Earth sit against the real terrain horizon, for power and direct to Earth communication. State up front that it is a planning tool, not for flight operations.");
  }

  // =========================================================== 2  PROBLEM
  {
    const s = pres.addSlide(); bg(s);
    title(s, "At the pole, terrain decides power and communication", "THE PROBLEM");
    const items = [
      [fa.FaSun, SUN, "Power", "The Sun stays within a few degrees of the horizon. A ridge can hide it for days, so a site can be lit for a week or dark for a week."],
      [fa.FaSatelliteDish, EARTH, "Communication", "Direct-to-Earth radio needs a line of sight. Earth sits low in the sky, so the same ridge can cut the link."],
      [fa.FaMountain, TEAL, "Real terrain", "A flat horizon is wrong. We cast rays across NASA's elevation map to find the true skyline in every direction."],
    ];
    const cw3 = (W - 2 * MX - 0.6) / 3; let x = MX; const cw = cw3, gap = 0.3;
    for (const [Comp, col, head, body] of items) {
      card(s, x, 1.95, cw, 3.1);
      await iconDisc(s, Comp, x + 0.35, 2.25, 0.8, col);
      s.addText(head, { x: x + 0.35, y: 3.2, w: cw - 0.7, h: 0.4, fontFace: FONT_H, fontSize: 22, bold: true, color: INK, margin: 0, isTextBox: true, objectName: head });
      s.addText(body, { x: x + 0.35, y: 3.7, w: cw - 0.7, h: 1.25, fontFace: FONT_B, fontSize: 15, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: head + " text" });
      x += cw + gap;
    }
    // big takeaway band
    card(s, MX, 5.35, W - 2 * MX, 1.35, PANEL2);
    s.addText([{ text: "The question a planner asks:  ", options: { color: MUTED } }, { text: "for this site, on these dates, how much sunlight and how much Earth link do we really get?", options: { color: INK, bold: true } }], { x: MX + 0.4, y: 5.35, w: W - 2 * MX - 0.8, h: 1.35, fontFace: FONT_B, fontSize: 20, valign: "middle", margin: 0, isTextBox: true, objectName: "Question" });
    footer(s, 2);
    s.addNotes("Explain why the lunar south pole is hard. Sun elevation is only a couple of degrees, so terrain, not distance, decides power and communication. Our tool answers the planner's question for any site and date window.");
  }

  // =========================================================== 3  HOW IT WORKS
  {
    const s = pres.addSlide(); bg(s);
    title(s, "Real data in, honest answer out", "HOW IT WORKS");
    const steps = [
      [fa.FaDatabase, EARTH, "NASA data", "JPL Horizons for Sun and Earth positions, 2026 to 2029. NASA PGDA LOLA elevation: 5 m site tiles, 87S mosaic and a 20 m map."],
      [fa.FaCrosshairs, SUN, "Skyline engine", "Rays every 0.25 degrees out to 300 km follow the curve of the Moon to find the horizon the lander would see."],
      [fa.FaChartLine, TEAL, "Metrics", "Sunlight, longest dark spell, Earth link and longest outage, each with an uncertainty range."],
      [fa.FaBalanceScale, RED, "Honest verdict", "If terrain data does not reach 300 km in every direction, the result is shown as an amber upper bound."],
    ];
    const cw = (W - 2 * MX - 0.9) / 4, gap = 0.3; let x = MX;
    for (let i = 0; i < steps.length; i++) {
      const [Comp, col, head, body] = steps[i];
      card(s, x, 1.95, cw, 3.3);
      s.addText(String(i + 1), { x: x + cw - 0.75, y: 2.05, w: 0.55, h: 0.55, fontFace: FONT_H, fontSize: 28, bold: true, color: "2A3A78", align: "right", margin: 0, isTextBox: true, objectName: "Step" + (i + 1) });
      await iconDisc(s, Comp, x + 0.3, 2.2, 0.75, col);
      s.addText(head, { x: x + 0.3, y: 3.15, w: cw - 0.6, h: 0.4, fontFace: FONT_H, fontSize: 20, bold: true, color: INK, margin: 0, isTextBox: true, objectName: head });
      s.addText(body, { x: x + 0.3, y: 3.6, w: cw - 0.6, h: 1.55, fontFace: FONT_B, fontSize: 14, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: head + " text" });
      if (i < steps.length - 1) {
        s.addText("\u203A", { x: x + cw - 0.02, y: 3.0, w: gap + 0.04, h: 0.6, fontFace: FONT_B, fontSize: 30, bold: true, color: SUN, align: "center", margin: 0, isTextBox: true, objectName: "Arrow" + (i + 1) });
      }
      x += cw + gap;
    }
    // evidence strip
    const stats = [["3", "terrain tiers merged"], ["14.09 GB", "NASA terrain, checksummed"], ["510", "Python tests"], ["125", "browser tests"]];
    let sx = MX; const sw = (W - 2 * MX - 3 * 0.3) / 4;
    for (const [big, small] of stats) {
      card(s, sx, 5.55, sw, 1.2, PANEL2);
      s.addText(big, { x: sx, y: 5.62, w: sw, h: 0.65, fontFace: FONT_H, fontSize: 30, bold: true, color: SUN, align: "center", margin: 0, isTextBox: true, objectName: "Stat " + small });
      s.addText(small, { x: sx, y: 6.27, w: sw, h: 0.35, fontFace: FONT_B, fontSize: 13, color: MUTED, align: "center", margin: 0, isTextBox: true, objectName: "Stat label " + small });
      sx += sw + 0.3;
    }
    footer(s, 3);
    s.addNotes("Walk left to right. Data: JPL Horizons for ephemerides, NASA GSFC PGDA LOLA elevation (5 m tiles, an 87S to 90S 5 m mosaic and a 20 m map, 14.09 GB downloaded with checksums). Engine: numba ray caster with lunar curvature. Verdict: if the data does not reach 300 km in every direction we say so. Test counts are from the release gate: 510 Python tests, 125 browser tests.");
  }

  // =========================================================== 4  PRODUCT
  {
    const s = pres.addSlide(); bg(s);
    title(s, "One screen: sky, horizon, terrain and verdict", "THE PRODUCT");
    // screenshot with frame
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 1.8, w: 8.35, h: 4.95, rectRadius: 0.1, fill: { color: PANEL }, line: { color: "22305F", width: 0.75 }, objectName: "ShotFrame" });
    s.addImage({ path: SHOT("30-command-1920.jpg"), x: MX + 0.08, y: 1.88, w: 8.19, h: 4.607, altText: "The Command Centre at 1920 by 1080: controls, sky chart, horizon strip, local terrain and verdict tiles on one screen" });
    const feats = [
      [fa.FaGlobe, EARTH, "Sky chart and horizon strip", "Sun and Earth tracks against the real skyline, above and below the horizon, with scales."],
      [fa.FaPlay, SUN, "Time you can play", "One clock drives every view. Play the Sun and Earth across a 3, 8, 15 or 30 day window."],
      [fa.FaMapMarkedAlt, TEAL, "Any site", "10 curated south pole sites, compare and slip matrix, or click the Trek map to build your own."],
    ];
    let y = 1.8;
    for (const [Comp, col, head, body] of feats) {
      card(s, 9.3, y, 3.33, 1.55);
      await iconDisc(s, Comp, 9.5, y + 0.25, 0.6, col);
      s.addText(head, { x: 10.25, y: y + 0.15, w: 2.25, h: 0.55, fontFace: FONT_H, fontSize: 15, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true, objectName: head });
      s.addText(body, { x: 10.25, y: y + 0.72, w: 2.25, h: 0.8, fontFace: FONT_B, fontSize: 12, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: head + " text" });
      y += 1.7;
    }
    footer(s, 4);
    s.addNotes("This is the live Command Centre for Shackleton rim, 11 December 2026, 15 days, captured from the deployed site. Left: controls and the time slider with Play. Centre: sky chart, horizon strip with the below-horizon band and labelled Sun and Earth paths, and the local terrain in 2D and 3D with scale bars. Right: verdict tiles. The same page lets you open the site in NASA QuickMap at that moment.");
  }

  // =========================================================== 5  HONESTY
  {
    const s = pres.addSlide(); bg(s);
    title(s, "We say when the answer is only a best case", "HONEST BY DESIGN");
    // left: explanation
    card(s, MX, 1.85, 5.85, 4.9);
    s.addText("Amber \u201CUpper bound\u201D", { x: MX + 0.4, y: 2.05, w: 5.05, h: 0.5, fontFace: FONT_H, fontSize: 24, bold: true, color: SUN, margin: 0, isTextBox: true, objectName: "Upper bound head" });
    s.addText([
      { text: "NASA terrain data ends before 300 km in some directions. What lies beyond could be a mountain, so the true skyline can only be higher.", options: { breakLine: true } },
      { text: "So the real sunlight and Earth link can only be lower than shown.", options: { breakLine: true, bold: true, color: INK } },
      { text: "We never show a green \u201CViable\u201D on an incomplete answer. A \u201CNot viable\u201D with this label is a firm no.", options: {} },
    ], { x: MX + 0.4, y: 2.7, w: 5.05, h: 2.35, fontFace: FONT_B, fontSize: 15, color: MUTED, margin: 0, valign: "top", paraSpaceAfter: 8, isTextBox: true, objectName: "Honesty text" });
    s.addText("46 to 95%", { x: MX + 0.4, y: 5.05, w: 5.05, h: 0.8, fontFace: FONT_H, fontSize: 44, bold: true, color: SUN, margin: 0, isTextBox: true, objectName: "Coverage stat" });
    s.addText("of directions reach the full 300 km at the 10 curated sites, so every site carries the amber label today.", { x: MX + 0.4, y: 5.85, w: 5.05, h: 0.8, fontFace: FONT_B, fontSize: 14, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: "Coverage stat text" });
    // coverage bar chart: share of directions that reach 300 km, per site (from docs/validation/REPORT.md section 6)
    const cov = [["Shackleton rim", 94.9], ["Connecting ridge", 85.0], ["de Gerlache rim", 75.8], ["Peak near Shackleton", 75.6], ["Malapert massif", 69.0], ["Shoemaker", 61.7], ["Haworth", 59.6], ["Leibnitz beta", 49.7], ["Nobile rim 1", 49.2], ["Nobile rim 2", 45.5]];
    const names = cov.map((c) => c[0]);
    const vals = cov.map((c) => c[1]);
    
    s.addChart(pres.charts.BAR, [{ name: "Directions reaching 300 km (%)", labels: names, values: vals }], {
      x: 6.8, y: 1.85, w: 5.83, h: 4.9, barDir: "bar", chartColors: [EARTH], catAxisOrientation: "maxMin",
      showTitle: true, title: "Share of directions where terrain reaches 300 km (%)", titleColor: INK, titleFontSize: 14, titleFontFace: FONT_B,
      showValue: true, dataLabelColor: INK, dataLabelFontSize: 11, dataLabelFontFace: FONT_B, dataLabelPosition: "outEnd",
      catAxisLabelColor: MUTED, catAxisLabelFontSize: 11, catAxisLabelFontFace: FONT_B,
      valAxisLabelColor: MUTED, valAxisLabelFontSize: 10, valAxisLabelFontFace: FONT_B, valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25,
      valGridLine: { color: "22305F", size: 0.5 }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 45,
    });
    s.addText("Source: docs/validation/REPORT.md, section 6 (VM precompute, 2026-11-15)", { x: 6.8, y: 6.62, w: 5.83, h: 0.25, fontFace: FONT_B, fontSize: 10, color: MUTED, margin: 0, isTextBox: true, objectName: "Chart source" });
    footer(s, 5);
    s.addNotes("This is our honesty rule. The terrain map used covers about 300 km from the pole, so for sites away from the pole some directions run off the data. The chart shows, per curated site, the share of directions that reach the full 300 km: 95 percent at Shackleton rim down to 46 percent at Nobile rim 2. Because of that every verdict is labelled an upper bound. Terrain beyond the data is not bounded in our numbers.");
  }

  // =========================================================== 6  VALIDATION
  {
    const s = pres.addSlide(); bg(s);
    title(s, "Checked against NASA records, misses included", "VALIDATION");
    // Apollo chart: difference in degrees
    const am = ["Apollo 11", "Apollo 12", "Apollo 14", "Apollo 15", "Apollo 16", "Apollo 17"];
    const diffs = [-0.097, 0.048, 0.049, -0.176, 2.861, 0.35];
    s.addChart(pres.charts.BAR, [{ name: "Our Sun elevation minus NASA (deg)", labels: am, values: diffs }], {
      x: MX, y: 1.85, w: 6.4, h: 4.1, barDir: "col", chartColors: [EARTH],
      showTitle: true, title: "Sun elevation at landing: ours minus NASA's (degrees)", titleColor: INK, titleFontSize: 14, titleFontFace: FONT_B,
      showValue: true, dataLabelColor: INK, dataLabelFontSize: 11, dataLabelFontFace: FONT_B, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00",
      catAxisLabelColor: MUTED, catAxisLabelFontSize: 11, catAxisLabelFontFace: FONT_B,
      valAxisLabelColor: MUTED, valAxisLabelFontSize: 10, valAxisLabelFontFace: FONT_B, valAxisMinVal: -1, valAxisMaxVal: 3.5, valAxisMajorUnit: 1,
      valGridLine: { color: "22305F", size: 0.5 }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 50,
    });
    s.addText("Source: NASA SP-4029 page 294; docs/validation/REPORT.md section 3", { x: MX, y: 5.95, w: 6.4, h: 0.25, fontFace: FONT_B, fontSize: 10, color: MUTED, margin: 0, isTextBox: true, objectName: "Chart source" });
    // right: findings cards
    const f = [
      [fa.FaCheckCircle, TEAL, "5 of 6 within 0.35\u00B0", "Sun direction at five Apollo landing sites matches NASA's printed value."],
      [fa.FaExclamationTriangle, RED, "Apollo 16 is off by 2.86\u00B0", "Recorded and not tuned. The cause is unknown."],
      [fa.FaMapPin, SUN, "QuickMap check", "Heights at 5 sites differ by 0.9 to 2.4 m at four, 12.3 m at one. 10 of 10 pre-registered shadow checks agree."],
    ];
    let y = 1.85;
    for (const [Comp, col, head, body] of f) {
      card(s, 7.35, y, 5.28, 1.3);
      await iconDisc(s, Comp, 7.55, y + 0.3, 0.7, col);
      s.addText(head, { x: 8.45, y: y + 0.12, w: 4.0, h: 0.4, fontFace: FONT_H, fontSize: 17, bold: true, color: INK, margin: 0, isTextBox: true, objectName: head });
      s.addText(body, { x: 8.45, y: y + 0.55, w: 4.0, h: 0.72, fontFace: FONT_B, fontSize: 13, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: head + " text" });
      y += 1.42;
    }
    // honest footnote
    card(s, MX, 6.28, W - 2 * MX, 0.62, PANEL2);
    s.addText("The QuickMap check was run by browser automation, not by a person, and all ten pre-registered shadow cases were Sun-down cases.", { x: MX + 0.3, y: 6.28, w: W - 2 * MX - 0.6, h: 0.62, fontFace: FONT_B, fontSize: 12, italic: true, color: MUTED, valign: "middle", margin: 0, isTextBox: true, objectName: "Limit" });
    footer(s, 6);
    s.addNotes("We validated against NASA's published Apollo landing Sun angles (SP-4029) and against QuickMap. Five of six Apollo sites agree within 0.35 degrees. Apollo 16 misses by 2.86 degrees and we report it rather than tune it. QuickMap heights differ by under 2.5 m at four of five sites and by 12.3 m at Shackleton rim. All ten pre-registered lit or shadowed checks matched, but all ten were cases where the Sun was down, which we say plainly. The QuickMap run was done by browser automation, not by a person.");
  }

  // =========================================================== 7  LIVE + TEAM + LINKS
  {
    const s = pres.addSlide(); bg(s);
    title(s, "Live today, open source, built by LunarOps", "TRY IT");
    const LIVE = "https://13-52-97-105.sslip.io";
    const GH = "https://github.com/fury-05/nasa-lunar-landing-navigator-2026";
    // left: links with QR codes
    const qrLive = await qr(LIVE, "060B18", "FFFFFF");
    const qrGh = await qr(GH, "060B18", "FFFFFF");
    card(s, MX, 1.85, 6.1, 2.2);
    s.addImage({ data: qrLive, x: MX + 0.3, y: 2.05, w: 1.8, h: 1.8, altText: "QR code for the live site" });
    s.addText("Live site", { x: MX + 2.4, y: 2.05, w: 3.5, h: 0.4, fontFace: FONT_H, fontSize: 20, bold: true, color: SUN, margin: 0, isTextBox: true, objectName: "Live head" });
    s.addText("13-52-97-105.sslip.io", { x: MX + 2.4, y: 2.5, w: 3.5, h: 0.4, fontFace: FONT_B, fontSize: 17, bold: true, color: INK, margin: 0, isTextBox: true, hyperlink: { url: LIVE }, objectName: "Live url" });
    s.addText("Command Centre, compare, slip matrix, site picker, public view. Runs on AWS.", { x: MX + 2.4, y: 2.95, w: 3.5, h: 0.9, fontFace: FONT_B, fontSize: 13, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: "Live text" });
    card(s, MX, 4.25, 6.1, 2.2);
    s.addImage({ data: qrGh, x: MX + 0.3, y: 4.45, w: 1.8, h: 1.8, altText: "QR code for the GitHub repository" });
    s.addText("GitHub", { x: MX + 2.4, y: 4.45, w: 3.5, h: 0.4, fontFace: FONT_H, fontSize: 20, bold: true, color: EARTH, margin: 0, isTextBox: true, objectName: "GH head" });
    s.addText("fury-05/nasa-lunar-landing-navigator-2026", { x: MX + 2.4, y: 4.9, w: 3.55, h: 0.55, fontFace: FONT_B, fontSize: 14, bold: true, color: INK, margin: 0, valign: "top", isTextBox: true, hyperlink: { url: GH }, objectName: "GH url" });
    s.addText("Open source, Apache-2.0. v1.0.0 stable release with full tests, docs and attribution.", { x: MX + 2.4, y: 5.5, w: 3.5, h: 0.85, fontFace: FONT_B, fontSize: 13, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: "GH text" });
    // right: team
    s.addText("Team LunarOps", { x: 7.2, y: 1.85, w: 5.4, h: 0.5, fontFace: FONT_H, fontSize: 24, bold: true, color: INK, margin: 0, isTextBox: true, objectName: "Team head" });
    const team = [
      ["Irfan S. Mulla", "@fury-05", "Engine, data, API, infrastructure and deploy", SUN],
      ["Afreen Mulla", "@Stella-10", "Web app, design system, Command Centre, map and mission clock", EARTH],
      ["Luz Aponte", "@nluz4105-ai", "Public View, Trek and QuickMap links, validation, attribution and demo", TEAL],
    ];
    let ty = 2.5;
    for (const [nm, gh, role, col] of team) {
      card(s, 7.2, ty, 5.43, 1.18);
      const initials = nm.split(" ").map((p) => p[0]).join("").slice(0, 2);
      s.addShape(pres.shapes.OVAL, { x: 7.4, y: ty + 0.24, w: 0.7, h: 0.7, fill: { color: PANEL2 }, line: { color: col, width: 1.25 }, objectName: "Avatar " + nm });
      s.addText(initials, { x: 7.4, y: ty + 0.24, w: 0.7, h: 0.7, fontFace: FONT_H, fontSize: 18, bold: true, color: col, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "Initials " + nm });
      s.addText([{ text: nm + "  ", options: { bold: true, color: INK } }, { text: gh, options: { color: col } }], { x: 8.3, y: ty + 0.12, w: 4.2, h: 0.4, fontFace: FONT_B, fontSize: 15, margin: 0, isTextBox: true, objectName: "Name " + nm });
      s.addText(role, { x: 8.3, y: ty + 0.52, w: 4.2, h: 0.6, fontFace: FONT_B, fontSize: 12, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: "Role " + nm });
      ty += 1.34;
    }
    s.addText("Built with Claude (Anthropic) as an AI assistant under human direction; disclosed in docs/SI_USAGE.md.", { x: 7.2, y: 6.55, w: 5.43, h: 0.4, fontFace: FONT_B, fontSize: 11, italic: true, color: MUTED, margin: 0, valign: "top", isTextBox: true, objectName: "AI note" });
    footer(s, 7);
    s.addNotes("Close with the live URL and the repository, both reachable by scanning the QR codes. Introduce the three team members and their areas. Mention that Claude was used as an assistant, disclosed in the repository. Invite the judges to open a site, press Play, and look for the amber upper bound label.");
  }

  await pres.writeFile({ fileName: path.join(REPO, "docs", "presentation", "LunarOps-Lunar-Landing-Site-Navigator.pptx") });
  console.log("written");
})().catch((e) => { console.error(e); process.exit(1); });
