/* @ds-bundle: {"format":4,"namespace":"TokenableDesignSystem_8d023b","components":[{"name":"FINALSYMBOLLOGO","sourcePath":"assets/logo/FINALSYMBOLLOGO.jsx"},{"name":"LOGO","sourcePath":"assets/logo/LOGO.jsx"},{"name":"SYMBOL","sourcePath":"assets/logo/SYMBOL.jsx"},{"name":"CollectibleCard","sourcePath":"components/commerce/CollectibleCard.jsx"},{"name":"Avatar","sourcePath":"components/data/Avatar.jsx"},{"name":"Badge","sourcePath":"components/data/Badge.jsx"},{"name":"Stat","sourcePath":"components/data/Stat.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"Tag","sourcePath":"components/data/Tag.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Notification","sourcePath":"components/feedback/Notification.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Search","sourcePath":"components/forms/Search.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Slider","sourcePath":"components/forms/Slider.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"Accordion","sourcePath":"components/layout/Accordion.jsx"},{"name":"Card","sourcePath":"components/layout/Card.jsx"},{"name":"Divider","sourcePath":"components/layout/Divider.jsx"},{"name":"DetailBar","sourcePath":"components/navigation/DetailBar.jsx"},{"name":"GNB","sourcePath":"components/navigation/GNB.jsx"},{"name":"Menu","sourcePath":"components/navigation/Menu.jsx"},{"name":"MobileNav","sourcePath":"components/navigation/MobileNav.jsx"},{"name":"Pagination","sourcePath":"components/navigation/Pagination.jsx"},{"name":"SecondaryBar","sourcePath":"components/navigation/SecondaryBar.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"assets/icons/pixel-icons.js":"99f8fcf84a0e","assets/logo/FINALSYMBOLLOGO.jsx":"986bdfac7aa8","assets/logo/LOGO.jsx":"4066aa8954dd","assets/logo/SYMBOL.jsx":"bcb01f1b6f57","components/commerce/CollectibleCard.jsx":"22037025d42d","components/data/Avatar.jsx":"093e171bda11","components/data/Badge.jsx":"4e14abf9c4c9","components/data/Stat.jsx":"ca4536c98104","components/data/Table.jsx":"75675a247d91","components/data/Tag.jsx":"8a84105cb643","components/feedback/Dialog.jsx":"4ba218643ce6","components/feedback/Notification.jsx":"ddb73fe44950","components/feedback/Tooltip.jsx":"f22ddc4734f6","components/forms/Button.jsx":"1ebf1fa7c3d6","components/forms/Checkbox.jsx":"433b35b1b223","components/forms/IconButton.jsx":"69f188e1fe5b","components/forms/Input.jsx":"226042d165db","components/forms/Radio.jsx":"9eda2adf76a9","components/forms/Search.jsx":"8303b62cf013","components/forms/Select.jsx":"1e5ecc97fbaa","components/forms/Slider.jsx":"a25156d171a7","components/forms/Switch.jsx":"48bdcc9be865","components/forms/Textarea.jsx":"b459a83847d0","components/layout/Accordion.jsx":"7548d1b38904","components/layout/Card.jsx":"23aeea13a2d3","components/layout/Divider.jsx":"044e56110d15","components/navigation/DetailBar.jsx":"d2195a0e3743","components/navigation/GNB.jsx":"9eb945eb4cad","components/navigation/Menu.jsx":"dcc2529d28c5","components/navigation/MobileNav.jsx":"511235a860db","components/navigation/Pagination.jsx":"40fca462e744","components/navigation/SecondaryBar.jsx":"83c81684bc7f","components/navigation/Tabs.jsx":"8f0ece8e2196","overview-components.jsx":"caabac84a51f","ui_kits/marketplace/DetailScreen.jsx":"2336299c6c58","ui_kits/marketplace/MarketCard.jsx":"99a76ec82b8f","ui_kits/marketplace/MarketHeader.jsx":"9a4ab1835e64","ui_kits/marketplace/MarketScreen.jsx":"db40c221e8ec","ui_kits/marketplace/PortfolioScreen.jsx":"bab3c138ebf8","ui_kits/marketplace/app.jsx":"60dce72c3e63","ui_kits/marketplace/data.js":"789cb9493562"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.TokenableDesignSystem_8d023b = window.TokenableDesignSystem_8d023b || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// assets/icons/pixel-icons.js
try { (() => {
// Tokenable — pixel icon set. Rect-grid glyphs (16x16), crisp pixel rendering.
// Usage: pixelIconSVG('search', { size: 20, color: '#fff' })  -> SVG markup string
//        window.PixelIcon({ name, size, color })              -> React element (if React present)
(function () {
  const G = {
    search: ["....######......", "...##....##.....", "..##......##....", ".##........##...", ".##........##...", ".##........##...", ".##........##...", "..##......##....", "...##....##.....", "....######.##...", ".........####...", "..........####..", "...........####.", "............##..", "................", "................"],
    heart: ["................", "..###....###....", ".#####..#####...", "##############..", "###############.", "###############.", "###############.", ".#############..", "..###########...", "...#########....", "....#######.....", ".....#####......", "......###.......", ".......#........", "................", "................"],
    check: ["................", "..............#.", ".............###", "............###.", "...........###..", "#.........###...", "##.......###....", "###.....###.....", ".###...###......", "..###.###.......", "...#####........", "....###.........", ".....#..........", "................", "................", "................"],
    x: ["................", ".##..........##.", "###........###..", ".###......###...", "..###....###....", "...###..###.....", "....######......", ".....####.......", ".....####.......", "....######......", "...###..###.....", "..###....###....", ".###......###...", "###........###..", ".##..........##.", "................"],
    plus: ["......####......", "......####......", "......####......", "......####......", "......####......", "......####......", ".##############.", ".##############.", ".##############.", ".##############.", "......####......", "......####......", "......####......", "......####......", "......####......", "................"],
    chevrondown: ["................", "................", "................", "##............##", "###..........###", ".###........###.", "..###......###..", "...###....###...", "....###..###....", ".....######.....", "......####......", ".......##.......", "................", "................", "................", "................"],
    chevronleft: ["................", "..........##....", ".........###....", "........###.....", ".......###......", "......###.......", ".....###........", "....###.........", "....###.........", ".....###........", "......###.......", ".......###......", "........###.....", ".........###....", "..........##....", "................"],
    arrowupright: ["................", ".....########...", ".....########...", "........#####...", ".......##.###...", "......##..###...", ".....##...###...", "....##....###...", "...##.....##....", "..##............", ".##.............", "##..............", "................", "................", "................", "................"],
    gem: ["................", "...##########...", "..############..", ".##############.", "################", ".##############.", "..############..", "...##########...", "....########....", ".....######.....", "......####......", ".......##.......", "................", "................", "................", "................"],
    bolt: [".........####...", "........####....", ".......####.....", "......####......", ".....####.......", "....##########..", "....##########..", ".......####.....", "......####......", ".....####.......", "....####........", "...####.........", "..####..........", "................", "................", "................"],
    shield: ["................", "..############..", ".##############.", "################", "################", "################", "################", ".##############.", ".##############.", "..############..", "...##########...", "....########....", ".....######.....", "......####......", ".......##.......", "................"],
    wallet: ["................", ".############...", "##############..", "##..........##..", "##..........##..", "##.......#####..", "##.......#..##..", "##.......#..##..", "##.......#####..", "##..........##..", "##############..", ".############...", "................", "................", "................", "................"],
    grid: ["................", ".#####..#####...", ".#####..#####...", ".#####..#####...", ".#####..#####...", ".#####..#####...", "................", ".#####..#####...", ".#####..#####...", ".#####..#####...", ".#####..#####...", ".#####..#####...", "................", "................", "................", "................"],
    filter: ["................", "##############..", "##############..", ".############...", "..##########....", "...########.....", "....######......", ".....####.......", ".....####.......", ".....####.......", ".....####.......", ".....####.......", "................", "................", "................", "................"],
    bell: ["................", "......####......", ".....######.....", "....########....", "....########....", "...##########...", "...##########...", "..############..", "..############..", ".##############.", "################", "................", "......####......", "......####......", "................", "................"],
    box: ["................", "################", "##............##", "##............##", "##....####....##", "##....####....##", "##............##", "##............##", "##............##", "##............##", "################", "................", "................", "................", "................", "................"],
    coin: ["................", "....######......", "..##########....", ".############...", "###...##...###..", "###...##...###..", "###...##...###..", "###...##...###..", "###...##...###..", ".############...", "..##########....", "....######......", "................", "................", "................", "................"],
    star: [".......##.......", ".......##.......", "......####......", "......####......", ".....######.....", ".....######.....", "################", ".##############.", "..############..", "...##########...", "...##########...", "..####....####..", ".####......####.", ".##..........##.", "##............##", "................"],
    eth: [".......##.......", "......####......", ".....######.....", "....########....", "...##########...", "..############..", ".##############.", "................", ".##############.", "..############..", "...##########...", "....########....", ".....######.....", "......####......", ".......##.......", "................"]
  };
  // normalize aliases
  G["chevron-down"] = G.chevrondown;
  G["chevron-left"] = G.chevronleft;
  G["arrow-up-right"] = G.arrowupright;
  G["trend-up"] = G.arrowupright;
  const SIZE = 16;
  function rects(grid) {
    let r = "";
    grid.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === "#") r += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    });
    return r;
  }
  function pixelIconSVG(name, opts) {
    opts = opts || {};
    const g = G[name];
    if (!g) return "";
    const size = opts.size || 20,
      color = opts.color || "currentColor";
    return `<svg viewBox="0 0 ${SIZE} ${SIZE}" width="${size}" height="${size}" fill="${color}" shape-rendering="crispEdges" aria-hidden="true">${rects(g)}</svg>`;
  }
  function PixelIcon(props) {
    props = props || {};
    const g = G[props.name];
    if (!g || typeof React === "undefined") return null;
    const size = props.size || 20;
    const els = [];
    g.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === "#") els.push(React.createElement("rect", {
        key: x + "_" + y,
        x,
        y,
        width: 1,
        height: 1
      }));
    });
    return React.createElement("svg", {
      viewBox: `0 0 ${SIZE} ${SIZE}`,
      width: size,
      height: size,
      fill: props.color || "currentColor",
      shapeRendering: "crispEdges",
      "aria-hidden": "true",
      style: props.style
    }, els);
  }
  window.PIXEL_GLYPHS = G;
  window.pixelIconSVG = pixelIconSVG;
  window.PixelIcon = PixelIcon;
  if (typeof module !== "undefined") module.exports = {
    pixelIconSVG,
    PixelIcon,
    PIXEL_GLYPHS: G
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/icons/pixel-icons.js", error: String((e && e.message) || e) }); }

// assets/logo/LOGO.jsx
try { (() => {
// figma node: 3191:2095 LOGO
function LOGO(_p = {}) {
  const props = _p;
  return /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 285.83,
      height: 28.96,
      position: "relative",
      color: "rgb(0,0,0)",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 20.520,
    height: 28,
    viewBox: "0 0 20.520 28",
    fill: "none",
    style: {
      position: "absolute",
      left: 236.407,
      top: 0.48,
      width: 20.52,
      height: 28
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 0 28 L 0 0 L 6.48 0 L 6.48 22.72 L 20.52 22.72 L 20.52 28 L 0 28 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  })), /*#__PURE__*/React.createElement("svg", {
    width: 25.680,
    height: 28,
    viewBox: "0 0 25.680 28",
    fill: "none",
    style: {
      position: "absolute",
      left: 202.221,
      top: 0.48,
      width: 25.68,
      height: 28
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 0 28 L 0 0 L 13.68 0 C 17.2 0 19.84 0.667 21.6 2 C 23.387 3.333 24.28 5.093 24.28 7.28 C 24.28 8.747 23.92 10.027 23.2 11.12 C 22.48 12.187 21.493 13.013 20.24 13.6 C 18.987 14.187 17.547 14.48 15.92 14.48 L 16.68 12.84 C 18.44 12.84 20 13.133 21.36 13.72 C 22.72 14.28 23.773 15.12 24.52 16.24 C 25.293 17.36 25.68 18.733 25.68 20.36 C 25.68 22.76 24.733 24.64 22.84 26 C 20.947 27.333 18.16 28 14.48 28 L 0 28 Z M 6.44 23.12 L 14 23.12 C 15.68 23.12 16.947 22.853 17.8 22.32 C 18.68 21.76 19.12 20.88 19.12 19.68 C 19.12 18.507 18.68 17.64 17.8 17.08 C 16.947 16.493 15.68 16.2 14 16.2 L 5.96 16.2 L 5.96 11.48 L 12.88 11.48 C 14.453 11.48 15.653 11.213 16.48 10.68 C 17.333 10.12 17.76 9.28 17.76 8.16 C 17.76 7.067 17.333 6.253 16.48 5.72 C 15.653 5.16 14.453 4.88 12.88 4.88 L 6.44 4.88 L 6.44 23.12 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  })), /*#__PURE__*/React.createElement("svg", {
    width: 31.400,
    height: 28,
    viewBox: "0 0 31.400 28",
    fill: "none",
    style: {
      position: "absolute",
      left: 164.316,
      top: 0.48,
      width: 31.4,
      height: 28
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 0 28 L 12.48 0 L 18.88 0 L 31.4 28 L 24.6 28 L 14.36 3.28 L 16.92 3.28 L 6.64 28 L 0 28 Z M 6.24 22 L 7.96 17.08 L 22.36 17.08 L 24.12 22 L 6.24 22 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  })), /*#__PURE__*/React.createElement("svg", {
    width: 25.680,
    height: 28,
    viewBox: "0 0 25.680 28",
    fill: "none",
    style: {
      position: "absolute",
      left: 132.091,
      top: 0.48,
      width: 25.68,
      height: 28
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 0 28 L 0 0 L 5.36 0 L 21.88 20.16 L 19.28 20.16 L 19.28 0 L 25.68 0 L 25.68 28 L 20.36 28 L 3.8 7.84 L 6.4 7.84 L 6.4 28 L 0 28 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  })), /*#__PURE__*/React.createElement("svg", {
    width: 21.680,
    height: 28,
    viewBox: "0 0 21.680 28",
    fill: "none",
    style: {
      position: "absolute",
      left: 101.656,
      top: 0.48,
      width: 21.68,
      height: 28
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 19.44 11.28 L 6.44 11.28 L 0 11.28 L 0 28 L 21.68 28 L 21.68 22.8 L 6.44 22.8 L 6.44 16.32 L 19.44 16.32 L 19.44 11.28 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 0 0 L 0 5.2 L 6.44 5.2 L 21.16 5.2 L 21.16 0 L 0 0 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  })), /*#__PURE__*/React.createElement("svg", {
    width: 21.680,
    height: 28,
    viewBox: "0 0 21.680 28",
    fill: "none",
    style: {
      position: "absolute",
      left: 264.15,
      top: 0.48,
      width: 21.68,
      height: 28
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 19.44 11.28 L 6.44 11.28 L 0 11.28 L 0 28 L 21.68 28 L 21.68 22.8 L 6.44 22.8 L 6.44 16.32 L 19.44 16.32 L 19.44 11.28 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 0 0 L 0 5.2 L 6.44 5.2 L 21.16 5.2 L 21.16 0 L 0 0 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  })), /*#__PURE__*/React.createElement("svg", {
    width: 26.720,
    height: 28,
    viewBox: "0 0 26.720 28",
    fill: "none",
    style: {
      position: "absolute",
      left: 68.446,
      top: 0.48,
      width: 26.72,
      height: 28
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 5.8 21.6 L 5.44 14.12 L 18.84 0 L 26.04 0 L 13.96 13 L 10.36 16.84 L 5.8 21.6 Z M 0 28 L 0 0 L 6.44 0 L 6.44 28 L 0 28 Z M 19.16 28 L 9.2 15.8 L 13.44 11.2 L 26.72 28 L 19.16 28 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  })), /*#__PURE__*/React.createElement("svg", {
    width: 30.640,
    height: 28.960,
    viewBox: "0 0 30.640 28.960",
    fill: "none",
    style: {
      position: "absolute",
      left: 29.336,
      top: 0,
      width: 30.64,
      height: 28.96
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 15.36 28.96 C 13.147 28.96 11.093 28.6 9.2 27.88 C 7.333 27.16 5.707 26.147 4.32 24.84 C 2.96 23.533 1.893 22 1.12 20.24 C 0.373 18.48 0 16.56 0 14.48 C 0 12.4 0.373 10.48 1.12 8.72 C 1.893 6.96 2.973 5.427 4.36 4.12 C 5.747 2.813 7.373 1.8 9.24 1.08 C 11.107 0.36 13.133 0 15.32 0 C 17.533 0 19.56 0.36 21.4 1.08 C 23.267 1.8 24.88 2.813 26.24 4.12 C 27.627 5.427 28.707 6.96 29.48 8.72 C 30.253 10.453 30.64 12.373 30.64 14.48 C 30.64 16.56 30.253 18.493 29.48 20.28 C 28.707 22.04 27.627 23.573 26.24 24.88 C 24.88 26.16 23.267 27.16 21.4 27.88 C 19.56 28.6 17.547 28.96 15.36 28.96 Z M 15.32 23.44 C 16.573 23.44 17.72 23.227 18.76 22.8 C 19.827 22.373 20.76 21.76 21.56 20.96 C 22.36 20.16 22.973 19.213 23.4 18.12 C 23.853 17.027 24.08 15.813 24.08 14.48 C 24.08 13.147 23.853 11.933 23.4 10.84 C 22.973 9.747 22.36 8.8 21.56 8 C 20.787 7.2 19.867 6.587 18.8 6.16 C 17.733 5.733 16.573 5.52 15.32 5.52 C 14.067 5.52 12.907 5.733 11.84 6.16 C 10.8 6.587 9.88 7.2 9.08 8 C 8.28 8.8 7.653 9.747 7.2 10.84 C 6.773 11.933 6.56 13.147 6.56 14.48 C 6.56 15.787 6.773 17 7.2 18.12 C 7.653 19.213 8.267 20.16 9.04 20.96 C 9.84 21.76 10.773 22.373 11.84 22.8 C 12.907 23.227 14.067 23.44 15.32 23.44 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  })), /*#__PURE__*/React.createElement("svg", {
    width: 24.400,
    height: 28,
    viewBox: "0 0 24.400 28",
    fill: "none",
    style: {
      position: "absolute",
      left: 0,
      top: 0.48,
      width: 24.4,
      height: 28
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 8.96 28 L 8.96 5.28 L 0 5.28 L 0 0 L 24.4 0 L 24.4 5.28 L 15.44 5.28 L 15.44 28 L 8.96 28 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  })));
}
Object.assign(__ds_scope, { LOGO, __ds_default_assets_logo_LOGO_3zhz2w: LOGO });
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/logo/LOGO.jsx", error: String((e && e.message) || e) }); }

// assets/logo/SYMBOL.jsx
try { (() => {
// figma node: 3191:2094 SYMBOL
function SYMBOL(_p = {}) {
  const props = _p;
  return /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 72,
      height: 72,
      overflow: "hidden",
      backgroundColor: "rgba(0,0,0,0)",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 49.714,
    height: 51.857,
    viewBox: "0 0 49.714 51.857",
    fill: "none",
    style: {
      position: "absolute",
      left: 11.143,
      top: 9.857,
      width: 49.714,
      height: 51.857
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 42.857 6.856 L 49.714 6.857 L 49.714 25.285 L 37.285 25.285 L 37.285 45 L 37.286 45 L 37.286 51.857 L 12 51.857 L 12 25.285 L 6.857 25.285 L 6.857 18.429 L 18.857 18.429 L 18.856 45 L 30.428 45 L 30.428 18.429 L 42.856 18.429 L 42.856 6.857 L 6.857 6.857 L 6.857 0 L 42.857 0 L 42.857 6.856 Z M 6.857 6.857 L 6.856 18.429 L 0 18.429 L 0 6.856 L 6.857 6.857 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  })));
}
Object.assign(__ds_scope, { SYMBOL, __ds_default_assets_logo_SYMBOL_cp51h9: SYMBOL });
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/logo/SYMBOL.jsx", error: String((e && e.message) || e) }); }

// assets/logo/FINALSYMBOLLOGO.jsx
try { (() => {
// figma node: 3191:2098 FINAL SYMBOL + LOGO
function FINALSYMBOLLOGO(_p = {}) {
  const props = _p;
  return /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: "fit-content",
      display: "flex",
      flexDirection: "row",
      gap: 20,
      padding: "30px 30px 30px 30px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 72,
      flexShrink: 0,
      alignSelf: "stretch",
      height: "auto"
    }
  }, props.icon1 ?? /*#__PURE__*/React.createElement(__ds_scope.SYMBOL, null)), /*#__PURE__*/React.createElement(__ds_scope.LOGO, {
    style: {
      position: "relative",
      width: 285.83,
      height: 28.96,
      flexShrink: 0
    }
  }));
}
Object.assign(__ds_scope, { FINALSYMBOLLOGO, __ds_default_assets_logo_FINALSYMBOLLOGO_1byuggo: FINALSYMBOLLOGO });
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/logo/FINALSYMBOLLOGO.jsx", error: String((e && e.message) || e) }); }

// components/commerce/CollectibleCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const NOTCH_LG = "polygon(0 8px, 4px 8px, 4px 4px, 8px 4px, 8px 0, calc(100% - 8px) 0, calc(100% - 8px) 4px, calc(100% - 4px) 4px, calc(100% - 4px) 8px, 100% 8px, 100% calc(100% - 8px), calc(100% - 4px) calc(100% - 8px), calc(100% - 4px) calc(100% - 4px), calc(100% - 8px) calc(100% - 4px), calc(100% - 8px) 100%, 8px 100%, 8px calc(100% - 4px), 4px calc(100% - 4px), 4px calc(100% - 8px), 0 calc(100% - 8px))";
const NOTCH_SM = "polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px))";

/* Inject keyframes once */
if (typeof document !== "undefined" && !document.getElementById("tk-card-shine-kf")) {
  const style = document.createElement("style");
  style.id = "tk-card-shine-kf";
  style.textContent = `
    @keyframes tk-card-shine {
      0% { transform: translateX(-100%) rotate(-25deg); }
      100% { transform: translateX(200%) rotate(-25deg); }
    }
    @keyframes tk-heart-bounce {
      0% { transform: scale(1); }
      25% { transform: scale(1.35); }
      50% { transform: scale(0.9); }
      75% { transform: scale(1.15); }
      100% { transform: scale(1); }
    }
    @keyframes tk-heart-float {
      0% { opacity: 1; transform: translate(0,0) scale(1); }
      100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.6); }
    }
  `;
  document.head.appendChild(style);
}

/**
 * CollectibleCard — graded-card market tile (chunky pixel notch).
 * Single-tone surface, equal padding all sides, no gradient.
 * Hover triggers a diagonal light sweep (shine/gleam effect).
 */
function CollectibleCard({
  variant = "trend",
  grade,
  title,
  set,
  price,
  sub,
  img,
  pop,
  listed,
  faved = false,
  onFav,
  subColor,
  onClick,
  className = "",
  ...rest
}) {
  const [hovered, setHovered] = React.useState(false);
  const [bouncing, setBouncing] = React.useState(false);
  const [floatingHearts, setFloatingHearts] = React.useState([]);
  const [favHovered, setFavHovered] = React.useState(false);
  const heartTimerRef = React.useRef(null);

  // Spawn floating hearts on fav button hover
  React.useEffect(() => {
    if (favHovered) {
      const spawn = () => {
        const id = Date.now() + Math.random();
        const tx = (Math.random() - 0.5) * 50;
        const ty = -(20 + Math.random() * 30);
        setFloatingHearts(prev => [...prev.slice(-6), {
          id,
          tx,
          ty
        }]);
      };
      spawn();
      heartTimerRef.current = setInterval(spawn, 350);
      return () => clearInterval(heartTimerRef.current);
    } else {
      clearInterval(heartTimerRef.current);
    }
  }, [favHovered]);
  const handleFavClick = e => {
    e.stopPropagation();
    setBouncing(true);
    setTimeout(() => setBouncing(false), 400);
    if (onFav) onFav();
  };
  const SUB_COLORS = {
    trend: "#00C350",
    new: "rgba(255,255,255,0.45)",
    rare: "#8EB4FF"
  };
  const sc = subColor || SUB_COLORS[variant] || SUB_COLORS.trend;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      cursor: onClick ? "pointer" : "default"
    },
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false)
  }, floatingHearts.map(h => /*#__PURE__*/React.createElement("span", {
    key: h.id,
    style: {
      position: "absolute",
      top: 30,
      right: 26,
      pointerEvents: "none",
      zIndex: 30,
      color: "#ff2244",
      fontSize: 16,
      animation: "tk-heart-float 0.8s ease-out forwards",
      "--tx": h.tx + "px",
      "--ty": h.ty + "px"
    }
  }, "\u2665")), /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    className: className,
    style: {
      position: "static",
      background: "#191919",
      borderRadius: 16,
      display: "flex",
      flexDirection: "column",
      padding: 8,
      gap: 12,
      boxShadow: hovered ? "0 8px 28px 0 rgba(0,0,0,0.55)" : "0 4px 16px 0 rgba(0,0,0,0.4)",
      transform: hovered ? "translate(-2px,-2px)" : "none",
      transition: "transform 120ms ease, box-shadow 120ms ease",
      overflow: "hidden"
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 10,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "-50%",
      left: 0,
      width: "60%",
      height: "200%",
      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.12) 60%, transparent)",
      transform: "translateX(-100%) rotate(-25deg)",
      opacity: hovered ? 1 : 0,
      transition: hovered ? "transform 0.6s ease, opacity 0.1s ease" : "opacity 0.3s ease",
      ...(hovered ? {
        transform: "translateX(200%) rotate(-25deg)"
      } : {})
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      aspectRatio: "0.72",
      background: "#111113",
      overflow: "hidden",
      borderRadius: 12
    }
  }, img ? /*#__PURE__*/React.createElement("img", {
    src: img,
    alt: title || "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      display: "block"
    }
  }) : null, onFav ? /*#__PURE__*/React.createElement("button", {
    onClick: handleFavClick,
    onMouseEnter: () => setFavHovered(true),
    onMouseLeave: () => setFavHovered(false),
    "aria-label": "Favorite",
    "aria-pressed": faved,
    style: {
      position: "absolute",
      top: 8,
      right: 8,
      zIndex: 15,
      width: 32,
      height: 32,
      border: 0,
      borderRadius: 8,
      cursor: "pointer",
      background: favHovered ? "rgba(255,68,102,0.25)" : "rgba(20,20,30,0.75)",
      boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.2), inset 0 2px 0 0 rgba(255,255,255,0.15)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: faved ? "#ff4466" : favHovered ? "#ff6688" : "rgba(255,255,255,0.9)",
      animation: bouncing ? "tk-heart-bounce 0.4s steps(6)" : "none",
      transition: "color 120ms steps(2), background 120ms steps(2)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
  }))) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    title: title,
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 18,
      fontWeight: 600,
      color: "#fff",
      lineHeight: 1.2,
      height: "2.7em",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
      alignSelf: "stretch"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, grade ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      fontWeight: 400,
      letterSpacing: "0",
      textTransform: "uppercase",
      color: "#fff",
      padding: "4px 8px",
      lineHeight: 1.2,
      background: "#0033FF",
      borderRadius: 6
    }
  }, grade) : null, pop ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      fontWeight: 400,
      color: "rgba(255,255,255,0.4)"
    }
  }, "POP", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "rgba(255,255,255,0.8)",
      marginLeft: 4
    }
  }, pop)) : null, listed ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      fontWeight: 400,
      color: "rgba(255,255,255,0.4)",
      lineHeight: 1.2
    }
  }, "LISTED", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "rgba(255,255,255,0.8)",
      marginLeft: 4
    }
  }, listed)) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 2
    }
  }, price ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 22,
      fontWeight: 600,
      color: "#fff",
      letterSpacing: "-0.02em"
    }
  }, price) : null, sub ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 14,
      fontWeight: 700,
      color: variant === "trend" ? "#00C350" : sc,
      textAlign: "right",
      alignSelf: "center",
      height: "100%",
      width: "100%"
    }
  }, variant === "trend" ? "▲ " : "", sub && sub.replace(" · ", "·")) : null))));
}
Object.assign(__ds_scope, { CollectibleCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/commerce/CollectibleCard.jsx", error: String((e && e.message) || e) }); }

// components/data/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Avatar — image, or initials fallback. */
function Avatar({
  src,
  alt,
  initials,
  size = "md",
  shape = "circle",
  ring = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `tk-avatar tk-avatar--${shape} tk-avatar--${size} ${ring ? "tk-avatar__ring" : ""} ${className}`
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt || ""
  }) : (initials || "").slice(0, 2).toUpperCase());
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Numeric / count badge. */
function Badge({
  children,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `tk-badge ${className}`
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data/Stat.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Stat chip — a key metric (POP, Listed, Offers): muted label + bright value. */
function Stat({
  label,
  value,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `tk-stat ${className}`
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "tk-stat__k"
  }, label), value);
}
Object.assign(__ds_scope, { Stat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Stat.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
/**
 * Data table with surface-based rows.
 * Supports sortable columns, row selection, card images, and mobile-optimized layout.
 * On mobile (< 600px), switches to a stacked card layout.
 */
function Table({
  columns = [],
  data = [],
  size = "md",
  selectable = false,
  onRowClick,
  selectedRows = [],
  onSelect,
  sortColumn,
  sortDirection = "asc",
  onSort,
  className = "",
  style
}) {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 599px)");
    const handler = e => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const sizes = {
    sm: {
      cell: "10px 14px",
      font: 13,
      headerFont: 11
    },
    md: {
      cell: "14px 18px",
      font: 14,
      headerFont: 12
    }
  };
  const s = sizes[size] || sizes.md;
  const handleSort = col => {
    if (!col.sortable || !onSort) return;
    const dir = sortColumn === col.key && sortDirection === "asc" ? "desc" : "asc";
    onSort(col.key, dir);
  };
  const isSelected = rowIdx => selectedRows.includes(rowIdx);
  const toggleSelect = rowIdx => {
    if (!onSelect) return;
    onSelect(isSelected(rowIdx) ? selectedRows.filter(i => i !== rowIdx) : [...selectedRows, rowIdx]);
  };

  /* ---------- Mobile: stacked card layout ---------- */
  if (isMobile) {
    return /*#__PURE__*/React.createElement("div", {
      className: `tk-table-wrap tk-table-wrap--mobile ${className}`,
      style: style
    }, data.map((row, rowIdx) => {
      const imgCol = columns.find(c => c.type === "image");
      const nameCol = columns.find(c => c.bold || c.key === "name");
      const otherCols = columns.filter(c => c !== imgCol && c !== nameCol);
      return /*#__PURE__*/React.createElement("div", {
        key: rowIdx,
        className: `tk-table-card ${isSelected(rowIdx) ? "tk-table-card--selected" : ""}`,
        onClick: () => onRowClick && onRowClick(row, rowIdx),
        style: {
          cursor: onRowClick ? "pointer" : "default"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 14,
          alignItems: "center"
        }
      }, selectable && /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: isSelected(rowIdx),
        onChange: () => toggleSelect(rowIdx),
        onClick: e => e.stopPropagation(),
        style: {
          accentColor: "var(--brand-500)",
          width: 16,
          height: 16,
          flexShrink: 0
        }
      }), imgCol && row[imgCol.key] && /*#__PURE__*/React.createElement("img", {
        src: row[imgCol.key],
        alt: "",
        style: {
          width: 48,
          height: 48,
          borderRadius: 8,
          objectFit: "cover",
          flexShrink: 0,
          background: "#111113"
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, nameCol && /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 15,
          fontWeight: 600,
          color: "#fff",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }
      }, nameCol.render ? nameCol.render(row[nameCol.key], row, rowIdx) : row[nameCol.key]), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 12,
          marginTop: 4,
          flexWrap: "wrap"
        }
      }, otherCols.map(col => /*#__PURE__*/React.createElement("span", {
        key: col.key,
        style: {
          fontSize: 13,
          fontFamily: col.mono ? "var(--font-mono)" : "var(--font-sans)",
          fontWeight: col.bold ? 600 : 400,
          color: col.color || "rgba(255,255,255,0.7)"
        }
      }, col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]))))));
    }));
  }

  /* ---------- Desktop: standard table ---------- */
  return /*#__PURE__*/React.createElement("div", {
    className: `tk-table-wrap ${className}`,
    style: style
  }, /*#__PURE__*/React.createElement("table", {
    className: `tk-table tk-table--${size}`,
    style: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: 0
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, selectable && /*#__PURE__*/React.createElement("th", {
    style: {
      width: 44,
      padding: s.cell,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedRows.length === data.length && data.length > 0,
    onChange: e => {
      if (onSelect) onSelect(e.target.checked ? data.map((_, i) => i) : []);
    }
  })), columns.map(col => /*#__PURE__*/React.createElement("th", {
    key: col.key,
    onClick: () => handleSort(col),
    style: {
      padding: s.cell,
      fontFamily: "var(--font-mono)",
      fontSize: s.headerFont,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: "rgba(255,255,255,0.5)",
      textAlign: col.align || "left",
      cursor: col.sortable ? "pointer" : "default",
      userSelect: "none",
      whiteSpace: "nowrap"
    }
  }, col.label, col.sortable && sortColumn === col.key && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 4,
      fontSize: 10
    }
  }, sortDirection === "asc" ? "▲" : "▼"))))), /*#__PURE__*/React.createElement("tbody", null, data.map((row, rowIdx) => /*#__PURE__*/React.createElement("tr", {
    key: rowIdx,
    className: `tk-table__row ${isSelected(rowIdx) ? "tk-table__row--selected" : ""}`,
    onClick: () => onRowClick && onRowClick(row, rowIdx),
    style: {
      cursor: onRowClick ? "pointer" : "default"
    }
  }, selectable && /*#__PURE__*/React.createElement("td", {
    style: {
      padding: s.cell,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: isSelected(rowIdx),
    onChange: () => toggleSelect(rowIdx),
    onClick: e => e.stopPropagation()
  })), columns.map(col => /*#__PURE__*/React.createElement("td", {
    key: col.key,
    style: {
      padding: s.cell,
      fontFamily: col.mono ? "var(--font-mono)" : "var(--font-sans)",
      fontSize: s.font,
      fontWeight: col.bold ? 600 : 400,
      color: col.color || "rgba(255,255,255,0.9)",
      textAlign: col.align || "left",
      whiteSpace: "nowrap"
    }
  }, col.type === "image" && row[col.key] ? /*#__PURE__*/React.createElement("img", {
    src: row[col.key],
    alt: "",
    style: {
      width: 40,
      height: 40,
      borderRadius: 6,
      objectFit: "cover",
      verticalAlign: "middle",
      background: "#111113"
    }
  }) : col.render ? col.render(row[col.key], row, rowIdx) : row[col.key])))))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/data/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Small status/category label. */
function Tag({
  scheme = "neutral",
  variant = "soft",
  icon,
  children,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `tk-tag tk-tag--${scheme} tk-tag--${variant} ${className}`
  }, rest), icon ? icon : null, children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
const CloseIcon = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("line", {
  x1: "18",
  y1: "6",
  x2: "6",
  y2: "18"
}), /*#__PURE__*/React.createElement("line", {
  x1: "6",
  y1: "6",
  x2: "18",
  y2: "18"
}));

/**
 * Glass modal dialog with brand glow. Card (centered) or sheet variant.
 * Renders nothing when `open` is false.
 */
function Dialog({
  open = true,
  type = "card",
  title,
  onClose,
  footer,
  showClose = true,
  children,
  className = ""
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "tk-dialog__overlay",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: `tk-dialog tk-dialog--${type} ${className}`,
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation()
  }, showClose && onClose ? /*#__PURE__*/React.createElement("button", {
    className: "tk-dialog__close",
    "aria-label": "Close",
    onClick: onClose
  }, CloseIcon) : null, title ? /*#__PURE__*/React.createElement("div", {
    className: "tk-dialog__head"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "tk-dialog__title"
  }, title)) : null, children ? /*#__PURE__*/React.createElement("div", {
    className: "tk-dialog__body"
  }, children) : null, footer ? /*#__PURE__*/React.createElement("div", {
    className: "tk-dialog__foot"
  }, footer) : null));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Notification.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ICONS = {
  brand: /*#__PURE__*/React.createElement("path", {
    d: "M12 16v-4M12 8h.01"
  }),
  positive: /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }),
  warning: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "9",
    x2: "12",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "17",
    x2: "12.01",
    y2: "17"
  })),
  danger: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "15",
    y1: "9",
    x2: "9",
    y2: "15"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "9",
    x2: "15",
    y2: "15"
  }))
};

/** Inline notification / toast message. */
function Notification({
  scheme = "brand",
  title,
  children,
  icon,
  className = "",
  ...rest
}) {
  const glyph = icon || /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, scheme === "brand" ? /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }) : null, ICONS[scheme]);
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `tk-note tk-note--${scheme} ${className}`,
    role: "status"
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "tk-note__icon"
  }, glyph), /*#__PURE__*/React.createElement("div", {
    className: "tk-note__body"
  }, title ? /*#__PURE__*/React.createElement("p", {
    className: "tk-note__title"
  }, title) : null, children ? /*#__PURE__*/React.createElement("p", {
    className: "tk-note__msg"
  }, children) : null));
}
Object.assign(__ds_scope, { Notification });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Notification.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
/** Hover tooltip wrapper. */
function Tooltip({
  content,
  placement = "top",
  children,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: `tk-tooltip ${className}`
  }, children, /*#__PURE__*/React.createElement("span", {
    className: `tk-tooltip__bubble tk-tooltip__bubble--${placement}`,
    role: "tooltip"
  }, content));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Tokenable Button — primary action control.
 * Azure gradient (primary), outline (neutral), faint fill (subtle), danger, or ghost (transparent + outline).
 */
function Button({
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  disabled = false,
  type = "button",
  children,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    className: `tk-btn tk-btn--${variant} tk-btn--${size} ${className}`
  }, rest), iconLeft ? /*#__PURE__*/React.createElement("span", {
    className: "tk-btn__icon"
  }, iconLeft) : null, children, iconRight ? /*#__PURE__*/React.createElement("span", {
    className: "tk-btn__icon"
  }, iconRight) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Checkbox with label. Controlled or uncontrolled. */
function Checkbox({
  label,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: `tk-check ${className}`
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox"
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "tk-check__box"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "3.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), label ? /*#__PURE__*/React.createElement("span", null, label) : null);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Icon-only circular button. */
function IconButton({
  variant = "neutral",
  size = "md",
  label,
  disabled = false,
  children,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    disabled: disabled,
    className: `tk-iconbtn tk-iconbtn--${variant} tk-iconbtn--${size} ${className}`
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Text input with optional label, hint and error state. */
function Input({
  label,
  hint,
  error,
  id,
  className = "",
  ...rest
}) {
  const inputId = id || (label ? `tk-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const input = /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    className: `tk-input ${error ? "tk-input--error" : ""} ${className}`
  }, rest));
  if (!label && !hint && !error) return input;
  return /*#__PURE__*/React.createElement("div", {
    className: "tk-field"
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "tk-field__label",
    htmlFor: inputId
  }, label) : null, input, error || hint ? /*#__PURE__*/React.createElement("span", {
    className: `tk-field__hint ${error ? "tk-field__hint--error" : ""}`
  }, error || hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Radio button with label. */
function Radio({
  label,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: `tk-check tk-check--radio ${className}`
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "radio"
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "tk-check__box"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tk-check__dot"
  })), label ? /*#__PURE__*/React.createElement("span", null, label) : null);
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Search.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SearchGlyph = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  width: "18",
  height: "18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2"
}, /*#__PURE__*/React.createElement("circle", {
  cx: "11",
  cy: "11",
  r: "7"
}), /*#__PURE__*/React.createElement("line", {
  x1: "21",
  y1: "21",
  x2: "16.5",
  y2: "16.5"
}));

/** Search input with a leading icon. */
function Search({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `tk-search ${className}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "tk-search__icon"
  }, SearchGlyph), /*#__PURE__*/React.createElement("input", _extends({
    className: "tk-input",
    type: "search",
    placeholder: "Search\u2026"
  }, rest)));
}
Object.assign(__ds_scope, { Search });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Search.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Native select styled to match Tokenable fields. */
function Select({
  label,
  hint,
  error,
  id,
  children,
  className = "",
  ...rest
}) {
  const inputId = id || (label ? `tk-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const control = /*#__PURE__*/React.createElement("div", {
    className: "tk-select-wrap"
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: inputId,
    className: `tk-input ${error ? "tk-input--error" : ""} ${className}`
  }, rest), children), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  })));
  if (!label && !hint && !error) return control;
  return /*#__PURE__*/React.createElement("div", {
    className: "tk-field"
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "tk-field__label",
    htmlFor: inputId
  }, label) : null, control, error || hint ? /*#__PURE__*/React.createElement("span", {
    className: `tk-field__hint ${error ? "tk-field__hint--error" : ""}`
  }, error || hint) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Slider.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Range slider. */
function Slider({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("input", _extends({
    type: "range",
    className: `tk-slider ${className}`
  }, rest));
}
Object.assign(__ds_scope, { Slider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Slider.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Toggle switch with optional label. */
function Switch({
  label,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: `tk-switch ${className}`
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    role: "switch"
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "tk-switch__track"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tk-switch__thumb"
  })), label ? /*#__PURE__*/React.createElement("span", null, label) : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Multi-line text field with optional label, hint and error. */
function Textarea({
  label,
  hint,
  error,
  id,
  className = "",
  ...rest
}) {
  const inputId = id || (label ? `tk-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const field = /*#__PURE__*/React.createElement("textarea", _extends({
    id: inputId,
    className: `tk-input ${error ? "tk-input--error" : ""} ${className}`
  }, rest));
  if (!label && !hint && !error) return field;
  return /*#__PURE__*/React.createElement("div", {
    className: "tk-field"
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "tk-field__label",
    htmlFor: inputId
  }, label) : null, field, error || hint ? /*#__PURE__*/React.createElement("span", {
    className: `tk-field__hint ${error ? "tk-field__hint--error" : ""}`
  }, error || hint) : null);
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/layout/Accordion.jsx
try { (() => {
const Chevron = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("polyline", {
  points: "6 9 12 15 18 9"
}));

/** Accordion — expandable item list. `items: [{title, content}]`. */
function Accordion({
  items = [],
  defaultOpen = null,
  allowMultiple = false,
  className = ""
}) {
  const [open, setOpen] = React.useState(() => defaultOpen != null ? [defaultOpen] : []);
  const toggle = i => setOpen(o => o.includes(i) ? o.filter(x => x !== i) : allowMultiple ? [...o, i] : [i]);
  return /*#__PURE__*/React.createElement("div", {
    className: `tk-accordion ${className}`
  }, items.map((it, i) => {
    const isOpen = open.includes(i);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: `tk-accordion__item ${isOpen ? "tk-accordion__item--open" : ""}`
    }, /*#__PURE__*/React.createElement("button", {
      className: "tk-accordion__trigger",
      "aria-expanded": isOpen,
      onClick: () => toggle(i)
    }, it.title, /*#__PURE__*/React.createElement("span", {
      className: "tk-accordion__chev"
    }, Chevron)), isOpen ? /*#__PURE__*/React.createElement("div", {
      className: "tk-accordion__content"
    }, it.content) : null);
  }));
}
Object.assign(__ds_scope, { Accordion });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/Accordion.jsx", error: String((e && e.message) || e) }); }

// components/layout/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Surface container. */
function Card({
  pad = true,
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `tk-card ${pad ? "tk-card--pad" : ""} ${className}`
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/Card.jsx", error: String((e && e.message) || e) }); }

// components/layout/Divider.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Hairline divider. */
function Divider({
  vertical = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "separator",
    className: `tk-divider ${vertical ? "tk-divider--v" : ""} ${className}`
  }, rest));
}
Object.assign(__ds_scope, { Divider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/Divider.jsx", error: String((e && e.message) || e) }); }

// components/navigation/DetailBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * DetailBar — sticky "buy bar" shown on a card detail page as you scroll.
 * Thumbnail + title/grade on the left, price + Make offer / Buy now on the right.
 */
function DetailBar({
  img,
  title,
  grade,
  price,
  sub,
  subColor,
  onBuy,
  onOffer,
  mobile = false,
  className = "",
  ...rest
}) {
  if (mobile) {
    return /*#__PURE__*/React.createElement("div", _extends({
      className: `tk-detailbar tk-detailbar--mobile ${className}`,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: "#0c0c14",
        borderTop: "2px solid var(--border-default-tertiary)",
        position: "sticky",
        bottom: 0,
        top: "auto",
        zIndex: 36
      }
    }, rest), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: 18,
        fontWeight: 700,
        color: "#fff",
        lineHeight: 1.1
      }
    }, price), sub ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        fontWeight: 700,
        color: subColor || "var(--text-positive-default)"
      }
    }, sub) : null), /*#__PURE__*/React.createElement(__ds_scope.Button, {
      variant: "neutral",
      onClick: onOffer,
      style: {
        flex: "0 0 auto"
      }
    }, "Offer"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
      variant: "primary",
      onClick: onBuy,
      style: {
        flex: 1
      }
    }, "Buy now"));
  }
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `tk-detailbar ${className}`,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      height: 64,
      padding: "0 24px",
      background: "#0c0c14",
      borderBottom: "2px solid var(--border-default-tertiary)",
      position: "sticky",
      top: 0,
      zIndex: 36
    }
  }, rest), img ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 52,
      background: "linear-gradient(180deg,#101018,#08080e)",
      overflow: "hidden",
      flexShrink: 0,
      boxShadow: "inset 0 0 0 2px var(--border-default-tertiary)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: img,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      display: "block"
    }
  })) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      fontWeight: 700,
      color: "#fff",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, title), grade ? /*#__PURE__*/React.createElement("span", {
    className: "tk-tag tk-tag--brand tk-tag--soft",
    style: {
      flexShrink: 0
    }
  }, grade) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      marginRight: 4,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 20,
      fontWeight: 700,
      color: "#fff"
    }
  }, price), sub ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 13,
      fontWeight: 700,
      color: subColor || "var(--text-positive-default)"
    }
  }, sub) : null), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "neutral",
    size: "sm",
    onClick: onOffer
  }, "Make offer"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    size: "sm",
    onClick: onBuy
  }, "Buy now"));
}
Object.assign(__ds_scope, { DetailBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/DetailBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/GNB.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * GNB — global navigation bar (desktop).
 * Logo on the left, center nav links with an azure active underline, and a right slot.
 */
function GNB({
  logo,
  links = [],
  active,
  onNavigate,
  right,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("header", _extends({
    className: `tk-gnb ${className}`,
    style: {
      display: "flex",
      alignItems: "center",
      height: 68,
      padding: "0 28px",
      background: "#000",
      borderBottom: "1px solid #2c2c2c",
      position: "sticky",
      top: 0,
      zIndex: 40
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      cursor: onNavigate ? "pointer" : "default"
    },
    onClick: () => onNavigate && onNavigate(links[0] && links[0].key)
  }, logo || /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 800,
      fontSize: 18,
      color: "#fff",
      letterSpacing: "-0.02em"
    }
  }, "Brand")), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: 4,
      marginLeft: 44
    }
  }, links.map(l => {
    const on = active === l.key;
    return /*#__PURE__*/React.createElement("button", {
      key: l.key,
      onClick: () => onNavigate && onNavigate(l.key),
      style: {
        position: "relative",
        background: "none",
        border: 0,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        fontWeight: on ? 600 : 500,
        color: on ? "#fff" : "#a7a9ac",
        padding: "8px 14px"
      }
    }, l.label, on ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: 14,
        right: 14,
        bottom: -23,
        height: 2,
        background: "var(--brand-500)"
      }
    }) : null);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, right));
}
Object.assign(__ds_scope, { GNB });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/GNB.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Menu.jsx
try { (() => {
/** Dropdown menu. `items: [{label, icon?, shortcut?, onClick} | {separator:true}]`. */
function Menu({
  items = [],
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `tk-menu ${className}`,
    role: "menu"
  }, items.map((it, i) => it.separator ? /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "tk-menu__sep"
  }) : /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "tk-menu__item",
    role: "menuitem",
    onClick: it.onClick
  }, it.icon ? it.icon : null, it.label, it.shortcut ? /*#__PURE__*/React.createElement("span", {
    className: "tk-menu__shortcut"
  }, it.shortcut) : null)));
}
Object.assign(__ds_scope, { Menu });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Menu.jsx", error: String((e && e.message) || e) }); }

// components/navigation/MobileNav.jsx
try { (() => {
const Hamburger = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  width: "22",
  height: "22",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  style: {
    shapeRendering: "crispEdges"
  }
}, /*#__PURE__*/React.createElement("line", {
  x1: "3",
  y1: "6",
  x2: "21",
  y2: "6"
}), /*#__PURE__*/React.createElement("line", {
  x1: "3",
  y1: "12",
  x2: "21",
  y2: "12"
}), /*#__PURE__*/React.createElement("line", {
  x1: "3",
  y1: "18",
  x2: "21",
  y2: "18"
}));
const Close = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  width: "22",
  height: "22",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  style: {
    shapeRendering: "crispEdges"
  }
}, /*#__PURE__*/React.createElement("line", {
  x1: "5",
  y1: "5",
  x2: "19",
  y2: "19"
}), /*#__PURE__*/React.createElement("line", {
  x1: "19",
  y1: "5",
  x2: "5",
  y2: "19"
}));

/**
 * MobileNav — mobile global nav bar with a hamburger that opens a full-height drawer.
 */
function MobileNav({
  logo,
  links = [],
  active,
  onNavigate,
  footer,
  className = ""
}) {
  const [open, setOpen] = React.useState(false);
  const go = k => {
    setOpen(false);
    onNavigate && onNavigate(k);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("header", {
    className: `tk-mobilenav ${className}`,
    style: {
      display: "flex",
      alignItems: "center",
      height: 58,
      padding: "0 16px",
      background: "#08080e",
      borderBottom: "2px solid var(--border-default-tertiary)",
      position: "sticky",
      top: 0,
      zIndex: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      flex: 1
    }
  }, logo || /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 800,
      fontSize: 17,
      color: "#fff"
    }
  }, "Brand")), /*#__PURE__*/React.createElement("button", {
    "aria-label": open ? "Close menu" : "Open menu",
    onClick: () => setOpen(o => !o),
    style: {
      width: 40,
      height: 40,
      border: 0,
      background: "transparent",
      color: "#fff",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, open ? Close : Hamburger)), open ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: "58px 0 0 0",
      zIndex: 39,
      background: "#08080e",
      display: "flex",
      flexDirection: "column",
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, links.map(l => {
    const on = active === l.key;
    return /*#__PURE__*/React.createElement("button", {
      key: l.key,
      onClick: () => go(l.key),
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: on ? "var(--background-brand-tertiary)" : "transparent",
        boxShadow: on ? "inset 0 0 0 2px var(--brand-500)" : "none",
        border: 0,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font-sans)",
        fontSize: 18,
        fontWeight: on ? 700 : 500,
        color: on ? "var(--text-brand-default)" : "#fff",
        padding: "16px 16px"
      }
    }, l.label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      borderTop: "2px solid var(--border-default-tertiary)"
    }
  }, footer) : null) : null);
}
Object.assign(__ds_scope, { MobileNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/MobileNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Pagination.jsx
try { (() => {
const L = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("polyline", {
  points: "15 18 9 12 15 6"
}));
const R = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("polyline", {
  points: "9 18 15 12 9 6"
}));

/** Pagination control. */
function Pagination({
  page = 1,
  total = 1,
  onChange,
  className = ""
}) {
  const go = p => {
    if (p >= 1 && p <= total && onChange) onChange(p);
  };
  const pages = [];
  for (let i = 1; i <= total; i++) pages.push(i);
  return /*#__PURE__*/React.createElement("nav", {
    className: `tk-pagination ${className}`,
    "aria-label": "Pagination"
  }, /*#__PURE__*/React.createElement("button", {
    className: "tk-page",
    disabled: page <= 1,
    onClick: () => go(page - 1),
    "aria-label": "Previous"
  }, L), pages.map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    className: `tk-page ${p === page ? "tk-page--active" : ""}`,
    "aria-current": p === page,
    onClick: () => go(p)
  }, p)), /*#__PURE__*/React.createElement("button", {
    className: "tk-page",
    disabled: page >= total,
    onClick: () => go(page + 1),
    "aria-label": "Next"
  }, R));
}
Object.assign(__ds_scope, { Pagination });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Pagination.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SecondaryBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SecondaryBar — sticky sub-navigation under the GNB.
 * Left title/back, center segmented tabs, right actions.
 */
function SecondaryBar({
  title,
  tabs = [],
  active,
  onTab,
  right,
  sticky = true,
  mobile = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `tk-secondarybar ${className}`,
    style: {
      display: "flex",
      alignItems: "center",
      gap: mobile ? 8 : 16,
      height: mobile ? 48 : 54,
      padding: mobile ? "0 12px" : "0 28px",
      background: "#0c0c14",
      borderBottom: "2px solid var(--border-default-tertiary)",
      position: sticky ? "sticky" : "static",
      top: mobile ? 58 : 68,
      zIndex: 35
    }
  }, rest), title ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: mobile ? 14 : 15,
      fontWeight: 700,
      color: "#fff",
      whiteSpace: "nowrap",
      flexShrink: 0
    }
  }, title) : null, tabs.length ? /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: 2,
      height: "100%",
      overflowX: "auto",
      minWidth: 0,
      scrollbarWidth: "none"
    }
  }, tabs.map(t => {
    const on = active === t.key;
    return /*#__PURE__*/React.createElement("button", {
      key: t.key,
      onClick: () => onTab && onTab(t.key),
      style: {
        position: "relative",
        background: "none",
        border: 0,
        cursor: "pointer",
        height: "100%",
        flexShrink: 0,
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        fontWeight: on ? 600 : 500,
        whiteSpace: "nowrap",
        color: on ? "var(--text-brand-default)" : "var(--text-default-secondary)",
        padding: mobile ? "0 10px" : "0 14px"
      }
    }, t.label, on ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: mobile ? 10 : 14,
        right: mobile ? 10 : 14,
        bottom: 0,
        height: 2,
        background: "var(--brand-500)"
      }
    }) : null);
  })) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), right ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexShrink: 0
    }
  }, right) : null);
}
Object.assign(__ds_scope, { SecondaryBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SecondaryBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
/** Segmented tabs. Controlled via `value`/`onChange`, or uncontrolled with `defaultValue`. */
function Tabs({
  items = [],
  value,
  defaultValue,
  onChange,
  className = ""
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? (items[0] && items[0].value));
  const active = value !== undefined ? value : internal;
  const select = v => {
    if (value === undefined) setInternal(v);
    onChange && onChange(v);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `tk-tabs ${className}`,
    role: "tablist"
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.value,
    role: "tab",
    "aria-selected": active === it.value,
    className: `tk-tab ${active === it.value ? "tk-tab--active" : ""}`,
    onClick: () => select(it.value)
  }, it.icon ? it.icon : null, it.label)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// overview-components.jsx
try { (() => {
const NS = window.TokenableDesignSystem_8d023b;
const {
  Button,
  IconButton,
  Input,
  Select,
  Textarea,
  Checkbox,
  Radio,
  Switch,
  Slider,
  Search,
  Tag,
  Badge,
  Avatar,
  Tabs,
  Pagination,
  Menu,
  Accordion,
  Divider,
  Card,
  Tooltip,
  Notification,
  GNB,
  SecondaryBar,
  MobileNav
} = NS;
const Ic = p => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  width: "18",
  height: "18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  style: {
    shapeRendering: "crispEdges"
  }
}, p.children);
const Plus = /*#__PURE__*/React.createElement(Ic, null, /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "5",
  x2: "12",
  y2: "19"
}), /*#__PURE__*/React.createElement("line", {
  x1: "5",
  y1: "12",
  x2: "19",
  y2: "12"
}));
const Arrow = /*#__PURE__*/React.createElement(Ic, null, /*#__PURE__*/React.createElement("line", {
  x1: "5",
  y1: "12",
  x2: "19",
  y2: "12"
}), /*#__PURE__*/React.createElement("polyline", {
  points: "12 5 19 12 12 19"
}));
const SearchG = /*#__PURE__*/React.createElement(Ic, null, /*#__PURE__*/React.createElement("circle", {
  cx: "11",
  cy: "11",
  r: "7"
}), /*#__PURE__*/React.createElement("line", {
  x1: "21",
  y1: "21",
  x2: "16.5",
  y2: "16.5"
}));
const Star = /*#__PURE__*/React.createElement(Ic, null, /*#__PURE__*/React.createElement("polygon", {
  points: "12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9"
}));
const dot = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  width: "12",
  height: "12",
  fill: "currentColor"
}, /*#__PURE__*/React.createElement("rect", {
  x: "7",
  y: "7",
  width: "10",
  height: "10"
}));
function Sec({
  id,
  title,
  children
}) {
  return /*#__PURE__*/React.createElement("section", {
    id: id
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sec__h"
  }, title), children);
}
function Blk({
  label,
  children,
  col
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "blk"
  }, label ? /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    className: "demo" + (col ? " demo--col" : "")
  }, children));
}
function Overview() {
  const [tab, setTab] = React.useState("overview");
  const [page, setPage] = React.useState(2);
  const [route, setRoute] = React.useState("market");
  const [sbTab, setSbTab] = React.useState("all");
  const logo = /*#__PURE__*/React.createElement("img", {
    src: "assets/logo/lockup-white.svg",
    height: "24",
    alt: "Tokenable"
  });
  const symbol = /*#__PURE__*/React.createElement("img", {
    src: "assets/logo/symbol-white.svg",
    height: "20",
    alt: "Tokenable"
  });
  const links = [{
    key: "market",
    label: "Markets"
  }, {
    key: "portfolio",
    label: "Portfolio"
  }, {
    key: "sell",
    label: "Sell"
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Sec, {
    id: "buttons",
    title: "Buttons & Actions"
  }, /*#__PURE__*/React.createElement(Blk, {
    label: "Variants \u2014 medium"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Buy now"), /*#__PURE__*/React.createElement(Button, {
    variant: "neutral"
  }, "Make offer"), /*#__PURE__*/React.createElement(Button, {
    variant: "subtle"
  }, "Watch"), /*#__PURE__*/React.createElement(Button, {
    variant: "danger"
  }, "Sell")), /*#__PURE__*/React.createElement(Blk, {
    label: "Small + icons + disabled"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    iconLeft: Plus
  }, "New listing"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "neutral",
    iconRight: Arrow
  }, "Continue"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "subtle",
    iconLeft: Star
  }, "Favorite"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    disabled: true
  }, "Disabled")), /*#__PURE__*/React.createElement(Blk, {
    label: "Icon buttons"
  }, /*#__PURE__*/React.createElement(IconButton, {
    variant: "primary",
    label: "Add"
  }, Plus), /*#__PURE__*/React.createElement(IconButton, {
    variant: "neutral",
    label: "Search"
  }, SearchG), /*#__PURE__*/React.createElement(IconButton, {
    variant: "subtle",
    label: "Favorite"
  }, Star))), /*#__PURE__*/React.createElement(Sec, {
    id: "fields",
    title: "Form Fields"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Email",
    type: "email",
    placeholder: "you@company.com",
    defaultValue: "ada@tokenable.io"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Token name",
    error: "Already taken",
    defaultValue: "primary"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Network",
    defaultValue: "Mainnet"
  }, /*#__PURE__*/React.createElement("option", null, "Mainnet"), /*#__PURE__*/React.createElement("option", null, "Testnet"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Search, {
    placeholder: "Search cards, sets, players\u2026"
  }), /*#__PURE__*/React.createElement(Textarea, {
    label: "Notes",
    rows: 2,
    placeholder: "Optional context\u2026"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, "Price range"), /*#__PURE__*/React.createElement(Slider, {
    min: 0,
    max: 100,
    defaultValue: 45
  }))))), /*#__PURE__*/React.createElement(Sec, {
    id: "toggles",
    title: "Toggles"
  }, /*#__PURE__*/React.createElement(Blk, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    label: "Enable webhooks",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement(Checkbox, {
    label: "Unchecked option"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      marginLeft: 32
    }
  }, /*#__PURE__*/React.createElement(Radio, {
    name: "r",
    label: "Monthly billing",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement(Radio, {
    name: "r",
    label: "Annual billing"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      marginLeft: 32
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    label: "Dark mode",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "Email alerts"
  })))), /*#__PURE__*/React.createElement(Sec, {
    id: "data",
    title: "Tags \xB7 Badges \xB7 Avatars"
  }, /*#__PURE__*/React.createElement(Blk, {
    label: "Soft tags"
  }, /*#__PURE__*/React.createElement(Tag, {
    scheme: "neutral"
  }, "Neutral"), /*#__PURE__*/React.createElement(Tag, {
    scheme: "brand"
  }, "PSA 10"), /*#__PURE__*/React.createElement(Tag, {
    scheme: "positive",
    icon: dot
  }, "Vaulted"), /*#__PURE__*/React.createElement(Tag, {
    scheme: "warning"
  }, "Pending"), /*#__PURE__*/React.createElement(Tag, {
    scheme: "danger"
  }, "Sold out")), /*#__PURE__*/React.createElement(Blk, {
    label: "Solid tags \xB7 stats \xB7 badges"
  }, /*#__PURE__*/React.createElement(Tag, {
    scheme: "brand",
    variant: "solid"
  }, "New"), /*#__PURE__*/React.createElement(Tag, {
    scheme: "positive",
    variant: "solid"
  }, "Live"), /*#__PURE__*/React.createElement("span", {
    className: "tk-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tk-stat__k"
  }, "POP"), "3"), /*#__PURE__*/React.createElement("span", {
    className: "tk-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tk-stat__k"
  }, "Listed"), "2"), /*#__PURE__*/React.createElement(Badge, null, "3"), /*#__PURE__*/React.createElement(Badge, null, "12"), /*#__PURE__*/React.createElement(Badge, null, "99+")), /*#__PURE__*/React.createElement(Blk, {
    label: "Avatars"
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: "TK",
    size: "sm"
  }), /*#__PURE__*/React.createElement(Avatar, {
    initials: "AD",
    size: "md",
    ring: true
  }), /*#__PURE__*/React.createElement(Avatar, {
    initials: "JS",
    size: "lg"
  }))), /*#__PURE__*/React.createElement(Sec, {
    id: "nav",
    title: "Navigation \u2014 Tabs \xB7 Pagination \xB7 Menu"
  }, /*#__PURE__*/React.createElement(Blk, {
    label: "Tabs"
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    items: [{
      value: "overview",
      label: "Overview"
    }, {
      value: "tokens",
      label: "Tokens"
    }, {
      value: "activity",
      label: "Activity"
    }, {
      value: "settings",
      label: "Settings"
    }]
  })), /*#__PURE__*/React.createElement(Blk, {
    label: "Pagination"
  }, /*#__PURE__*/React.createElement(Pagination, {
    page: page,
    total: 7,
    onChange: setPage
  })), /*#__PURE__*/React.createElement(Blk, {
    label: "Menu"
  }, /*#__PURE__*/React.createElement(Menu, {
    items: [{
      label: "View card",
      icon: /*#__PURE__*/React.createElement(Ic, null, /*#__PURE__*/React.createElement("path", {
        d: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "3"
      })),
      shortcut: "⏎"
    }, {
      label: "Make offer",
      icon: /*#__PURE__*/React.createElement(Ic, null, /*#__PURE__*/React.createElement("path", {
        d: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10z"
      }))
    }, {
      separator: true
    }, {
      label: "Report",
      icon: /*#__PURE__*/React.createElement(Ic, null, /*#__PURE__*/React.createElement("path", {
        d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "4",
        y1: "22",
        x2: "4",
        y2: "15"
      }))
    }]
  }))), /*#__PURE__*/React.createElement(Sec, {
    id: "nav3",
    title: "Navigation \u2014 GNB \xB7 Secondary \xB7 Mobile"
  }, /*#__PURE__*/React.createElement("div", {
    className: "blk"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, "GNB \u2014 desktop"), /*#__PURE__*/React.createElement("div", {
    className: "frame"
  }, /*#__PURE__*/React.createElement(GNB, {
    logo: logo,
    links: links,
    active: route,
    onNavigate: setRoute,
    right: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IconButton, {
      variant: "subtle",
      label: "Search"
    }, SearchG), /*#__PURE__*/React.createElement(Avatar, {
      initials: "FK",
      size: "sm"
    }))
  }))), /*#__PURE__*/React.createElement("div", {
    className: "blk"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, "Secondary sticky bar"), /*#__PURE__*/React.createElement("div", {
    className: "frame"
  }, /*#__PURE__*/React.createElement(SecondaryBar, {
    sticky: false,
    title: "Markets",
    active: sbTab,
    onTab: setSbTab,
    tabs: [{
      key: "all",
      label: "All"
    }, {
      key: "pokemon",
      label: "Pokémon"
    }, {
      key: "sports",
      label: "Sports"
    }],
    right: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "neutral"
    }, "Filters")
  }))), /*#__PURE__*/React.createElement("div", {
    className: "blk"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, "Mobile GNB + hamburger (tap \u2630)"), /*#__PURE__*/React.createElement("div", {
    className: "frame",
    style: {
      width: 360,
      position: "relative",
      height: 280
    }
  }, /*#__PURE__*/React.createElement(MobileNav, {
    logo: symbol,
    links: links,
    active: route,
    onNavigate: setRoute,
    footer: /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      style: {
        width: "100%"
      }
    }, "Connect Wallet")
  })))), /*#__PURE__*/React.createElement(Sec, {
    id: "disclosure",
    title: "Accordion \xB7 Divider \xB7 Card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, "Accordion"), /*#__PURE__*/React.createElement(Accordion, {
    defaultOpen: 0,
    items: [{
      title: "What is vaulting?",
      content: "Cards are physically stored, insured and tokenized."
    }, {
      title: "How do fees work?",
      content: "A flat 2% on settled trades."
    }, {
      title: "Can I redeem?",
      content: "Yes — request redemption any time."
    }]
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, "Card"), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 16
    }
  }, "API usage"), /*#__PURE__*/React.createElement(Tag, {
    scheme: "positive"
  }, "Healthy")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 16px",
      fontSize: 14,
      lineHeight: 1.5,
      color: "var(--text-default-secondary)"
    }
  }, "48,210 of 100,000 requests used this cycle."), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "neutral"
  }, "View report")))))), /*#__PURE__*/React.createElement(Sec, {
    id: "feedback",
    title: "Feedback \u2014 Notifications \xB7 Tooltip \xB7 Dialog"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Notification, {
    scheme: "positive",
    title: "Deployed"
  }, "Your tokens are live on Mainnet."), /*#__PURE__*/React.createElement(Notification, {
    scheme: "warning",
    title: "Rate limit near"
  }, "82% of your quota used this cycle."), /*#__PURE__*/React.createElement(Notification, {
    scheme: "danger",
    title: "Transaction failed"
  }, "Could not reach the network."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Tooltip, {
    content: "Hover tooltips work too"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "neutral",
    size: "sm"
  }, "Hover me")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "sub"
  }, "Dialog"), /*#__PURE__*/React.createElement("div", {
    className: "tk-dialog",
    style: {
      position: "relative",
      maxWidth: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "tk-dialog__head"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "tk-dialog__title"
  }, "Delete token?")), /*#__PURE__*/React.createElement("div", {
    className: "tk-dialog__body"
  }, "This permanently removes ", /*#__PURE__*/React.createElement("b", null, "primary"), " and revokes all keys."), /*#__PURE__*/React.createElement("div", {
    className: "tk-dialog__foot"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "subtle",
    size: "sm"
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    size: "sm"
  }, "Delete"))))), /*#__PURE__*/React.createElement("a", {
    className: "kit-link",
    href: "ui_kits/marketplace/index.html"
  }, "Open the marketplace UI kit \u2192")));
}
ReactDOM.createRoot(document.getElementById("components")).render(/*#__PURE__*/React.createElement(Overview, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "overview-components.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketplace/DetailScreen.jsx
try { (() => {
// Card detail screen
function DetailScreen({
  card,
  onBack,
  faves,
  onFav,
  onBuy
}) {
  const {
    fmt,
    pct,
    icons
  } = window.TKData;
  const {
    Button,
    Tag,
    Tabs
  } = window.TokenableDesignSystem_8d023b;
  const up = card.change >= 0;
  const [tab, setTab] = React.useState("overview");

  // sparkline
  const pts = [12, 18, 16, 24, 22, 30, 28, 40, 38, 52, 60, 58, 72];
  const w = 560,
    h = 180,
    max = Math.max(...pts),
    min = Math.min(...pts);
  const path = pts.map((v, i) => `${i / (pts.length - 1) * w},${h - (v - min) / (max - min) * (h - 20) - 10}`).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "24px 40px 64px"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "none",
      border: 0,
      cursor: "pointer",
      color: "#a7a9ac",
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      fontWeight: 500,
      padding: "8px 0",
      marginBottom: 16
    }
  }, icons.ChevronLeft({
    width: 16,
    height: 16
  }), " Back to market"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "440px 1fr",
      gap: 40,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      background: "#191919",
      borderRadius: 16,
      padding: 24,
      position: "sticky",
      top: 92
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: card.img,
    alt: card.title,
    style: {
      width: "100%",
      display: "block"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => onFav(card.id),
    "aria-label": "Favorite",
    style: {
      position: "absolute",
      top: 36,
      right: 36,
      width: 38,
      height: 38,
      border: 0,
      borderRadius: 8,
      cursor: "pointer",
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: faves.has(card.id) ? "var(--brand-400)" : "#fff"
    }
  }, icons.Heart({
    width: 18,
    height: 18
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    scheme: "brand",
    variant: "soft"
  }, card.grade), /*#__PURE__*/React.createElement("span", {
    className: "tk-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tk-stat__k"
  }, card.pop.split(" ")[0]), card.pop.split(" ").slice(1).join(" ")), /*#__PURE__*/React.createElement("span", {
    className: "tk-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tk-stat__k"
  }, "Listed"), card.listed), /*#__PURE__*/React.createElement(Tag, {
    scheme: "neutral",
    variant: "soft",
    icon: icons.Check({
      width: 12,
      height: 12
    })
  }, "Vaulted & insured")), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 34,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "#fff",
      lineHeight: 1.1
    }
  }, card.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 13,
      color: "#6d6e71",
      marginTop: 6
    }
  }, card.set), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      padding: 22,
      background: "#191919",
      borderRadius: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "#6d6e71"
    }
  }, "Last sale"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 10,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 38,
      fontWeight: 700,
      color: "#fff"
    }
  }, fmt(card.price)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontFamily: "var(--font-mono)",
      fontSize: 14,
      fontWeight: 700,
      color: up ? "#00C350" : "#E4374A"
    }
  }, icons.TrendUp({
    width: 15,
    height: 15
  }), pct(card.change), " \xB7 ", card.period))), /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    items: [{
      value: "overview",
      label: "1M"
    }, {
      value: "y",
      label: "1Y"
    }, {
      value: "all",
      label: "All"
    }]
  })), /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${w} ${h}`,
    style: {
      width: "100%",
      height: 150,
      marginTop: 14,
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "spark",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "rgba(26,111,255,0.35)"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "rgba(26,111,255,0)"
  }))), /*#__PURE__*/React.createElement("polygon", {
    points: `0,${h} ${path} ${w},${h}`,
    fill: "url(#spark)"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: path,
    fill: "none",
    stroke: "var(--brand-500)",
    strokeWidth: "2.5",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => onBuy(card),
    iconLeft: icons.Wallet({
      width: 16,
      height: 16
    }),
    style: {
      flex: 1
    }
  }, "Buy now \xB7 ", fmt(card.price)), /*#__PURE__*/React.createElement(Button, {
    variant: "neutral"
  }, "Make offer")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
      marginTop: 24
    }
  }, [["Grade", card.grade], ["Population", card.pop.replace("POP ", "")], ["Listed", card.listed + " active"], ["Category", card.cat]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      padding: "14px 16px",
      background: "#191919",
      borderRadius: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "#6d6e71",
      textTransform: "uppercase",
      letterSpacing: "0.06em"
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 16,
      fontWeight: 700,
      color: "#fff",
      marginTop: 4
    }
  }, v)))))));
}
window.DetailScreen = DetailScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketplace/DetailScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketplace/MarketCard.jsx
try { (() => {
// Market card — thin wrapper over the design-system CollectibleCard (single source of truth).
function MarketCard({
  card,
  onOpen,
  faved,
  onFav
}) {
  const {
    fmt,
    pct
  } = window.TKData;
  const {
    CollectibleCard
  } = window.TokenableDesignSystem_8d023b;
  const up = card.change >= 0;
  return /*#__PURE__*/React.createElement(CollectibleCard, {
    grade: card.grade,
    title: card.title,
    set: card.set,
    price: fmt(card.price),
    sub: `${pct(card.change)} · ${card.period}`,
    subColor: up ? "#00C350" : "#E4374A",
    pop: card.pop.replace("POP ", ""),
    listed: card.listed,
    img: card.img,
    faved: faved,
    onFav: () => onFav(card.id),
    onClick: () => onOpen(card)
  });
}
window.MarketCard = MarketCard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketplace/MarketCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketplace/MarketHeader.jsx
try { (() => {
// Tokenable marketplace header — composes the design-system GNB with product chrome.
function MarketHeader({
  route,
  onNavigate,
  balance = 12400
}) {
  const {
    icons
  } = window.TKData;
  const {
    GNB,
    IconButton,
    Avatar
  } = window.TokenableDesignSystem_8d023b;
  const logo = /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo/lockup-white.svg",
    height: "26",
    alt: "Tokenable"
  });
  const links = [{
    key: "market",
    label: "Markets"
  }, {
    key: "portfolio",
    label: "Portfolio"
  }, {
    key: "sell",
    label: "Sell"
  }];
  const right = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IconButton, {
    variant: "subtle",
    label: "Search"
  }, icons.SearchFull({
    width: 18,
    height: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      height: 38,
      padding: "0 12px",
      background: "rgba(64,91,255,0.12)",
      boxShadow: "inset 0 0 0 2px var(--brand-500)",
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: "0.03em",
      color: "#7084ff",
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      background: "var(--brand-400)"
    }
  }), "Ethereum ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#6d6e71",
      fontWeight: 400
    }
  }, "14 gwei")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: 38,
      padding: "0 5px 0 12px",
      background: "var(--background-neutral-secondary)",
      boxShadow: "inset 0 0 0 2px #2c2c2c",
      fontFamily: "var(--font-mono)",
      fontSize: 13,
      color: "#fff",
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#6d6e71",
      fontSize: 12
    }
  }, "BAL"), window.TKData.fmt(balance), /*#__PURE__*/React.createElement(Avatar, {
    initials: "FK",
    size: "sm"
  })));
  return /*#__PURE__*/React.createElement(GNB, {
    logo: logo,
    links: links,
    active: route,
    onNavigate: onNavigate,
    right: right
  });
}
window.MarketHeader = MarketHeader;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketplace/MarketHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketplace/MarketScreen.jsx
try { (() => {
// Marketplace browse screen
function MarketScreen({
  onOpen,
  faves,
  onFav
}) {
  const {
    cards,
    icons
  } = window.TKData;
  const {
    Tabs,
    Button
  } = window.TokenableDesignSystem_8d023b;
  const [cat, setCat] = React.useState("all");
  const [sort, setSort] = React.useState("trending");
  const filtered = cards.filter(c => cat === "all" || c.cat.toLowerCase() === cat);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "44px 40px 28px",
      maxWidth: 1240,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 24,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "6px 11px",
      background: "var(--background-positive-tertiary)",
      boxShadow: "inset 0 0 0 2px var(--border-positive-default)",
      color: "#00C350",
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.03em",
      marginBottom: 16
    }
  }, icons.Shield({
    width: 14,
    height: 14
  }), " Every card vaulted & insured"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 44,
      fontWeight: 700,
      letterSpacing: "-0.03em",
      color: "#fff",
      lineHeight: 1.05
    }
  }, "The graded card market"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "12px 0 0",
      fontFamily: "var(--font-sans)",
      fontSize: 17,
      color: "#a7a9ac",
      maxWidth: 460,
      lineHeight: 1.5
    }
  }, "Trade tokenized, vault-secured collectibles. Real-time pricing, instant settlement.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 28
    }
  }, [["Vault value", "$2.4B"], ["24h volume", "$18.6M"], ["Cards vaulted", "412k"]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 28,
      fontWeight: 700,
      color: "#fff"
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "#6d6e71",
      marginTop: 2
    }
  }, l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      top: 68,
      zIndex: 30,
      background: "rgba(8,8,14,0.85)",
      backdropFilter: "blur(10px)",
      borderTop: "1px solid #2c2c2c",
      borderBottom: "1px solid #2c2c2c"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: "0 auto",
      padding: "12px 40px",
      display: "flex",
      alignItems: "center",
      gap: 16,
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: cat,
    onChange: setCat,
    items: [{
      value: "all",
      label: "All",
      icon: icons.Grid({
        width: 16,
        height: 16
      })
    }, {
      value: "pokémon",
      label: "Pokémon"
    }, {
      value: "sports",
      label: "Sports"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "subtle",
    size: "sm",
    onClick: () => setSort(sort === "trending" ? "price" : "trending"),
    iconLeft: icons.TrendUp({
      width: 15,
      height: 15
    }),
    iconRight: icons.ChevronDown({
      width: 15,
      height: 15
    })
  }, sort === "trending" ? "Trending" : "Price: high"), /*#__PURE__*/React.createElement(Button, {
    variant: "neutral",
    size: "sm",
    iconLeft: icons.Filter({
      width: 15,
      height: 15
    })
  }, "Filters")))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: "0 auto",
      padding: "28px 40px 64px",
      background: "#0e0e0e"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 22
    }
  }, filtered.map(c => /*#__PURE__*/React.createElement(MarketCard, {
    key: c.id,
    card: c,
    onOpen: onOpen,
    faved: faves.has(c.id),
    onFav: onFav
  })))));
}
window.MarketScreen = MarketScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketplace/MarketScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketplace/PortfolioScreen.jsx
try { (() => {
// Portfolio / vault screen
function PortfolioScreen({
  onOpenMarket
}) {
  const {
    holdings,
    fmt,
    pct,
    icons
  } = window.TKData;
  const {
    Card,
    Tag,
    Button,
    Avatar,
    Table
  } = window.TokenableDesignSystem_8d023b;
  const totalValue = holdings.reduce((s, h) => s + h.value * h.qty, 0);
  const totalCost = holdings.reduce((s, h) => s + h.cost * h.qty, 0);
  const gain = (totalValue - totalCost) / totalCost * 100;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: "0 auto",
      padding: "40px 40px 64px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      marginBottom: 26
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: "FK",
    size: "lg",
    ring: true
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 26,
      fontWeight: 700,
      color: "#fff"
    }
  }, "Your vault"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 13,
      color: "#6d6e71",
      marginTop: 2
    }
  }, "0xF4\u20269aE2 \xB7 ", holdings.length, " positions"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 16,
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "#6d6e71"
    }
  }, "Portfolio value"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 32,
      fontWeight: 700,
      color: "#fff",
      marginTop: 6
    }
  }, fmt(totalValue)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    scheme: "positive",
    icon: icons.TrendUp({
      width: 12,
      height: 12
    })
  }, pct(gain), " all time"))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "#6d6e71"
    }
  }, "Total cost basis"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 32,
      fontWeight: 700,
      color: "#fff",
      marginTop: 6
    }
  }, fmt(totalCost)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      color: "#a7a9ac"
    }
  }, "Unrealized ", fmt(totalValue - totalCost))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "#6d6e71"
    }
  }, "Cash balance"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 32,
      fontWeight: 700,
      color: "#fff",
      marginTop: 6
    }
  }, fmt(12400)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "neutral"
  }, "Add funds")))), /*#__PURE__*/React.createElement(Table, {
    columns: [{
      key: "img",
      label: "",
      type: "image"
    }, {
      key: "title",
      label: "Asset",
      bold: true,
      render: (v, row) => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          fontFamily: "var(--font-sans)",
          fontSize: 15,
          fontWeight: 600,
          color: "#fff"
        }
      }, v), /*#__PURE__*/React.createElement("div", {
        style: {
          marginTop: 3
        }
      }, /*#__PURE__*/React.createElement(Tag, {
        scheme: "brand",
        variant: "soft"
      }, row.grade)))
    }, {
      key: "qty",
      label: "Qty",
      mono: true,
      color: "#a7a9ac"
    }, {
      key: "cost",
      label: "Avg cost",
      mono: true,
      color: "#a7a9ac",
      render: v => fmt(v)
    }, {
      key: "totalValue",
      label: "Value",
      mono: true,
      bold: true,
      render: v => fmt(v)
    }, {
      key: "returnPct",
      label: "Return",
      align: "right",
      mono: true,
      bold: true,
      render: v => /*#__PURE__*/React.createElement("span", {
        style: {
          color: v >= 0 ? "#00C350" : "#E4374A"
        }
      }, pct(v))
    }, {
      key: "action",
      label: "",
      align: "right",
      render: () => /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 8,
          justifyContent: "flex-end"
        }
      }, /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        size: "table"
      }, "Set price"), /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        size: "table"
      }, "List"))
    }],
    data: holdings.map(h => ({
      img: "../../assets/cards/nidoking.jpg",
      title: h.title,
      grade: h.grade,
      qty: h.qty,
      cost: h.cost,
      totalValue: h.value * h.qty,
      returnPct: (h.value - h.cost) / h.cost * 100
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "neutral",
    onClick: onOpenMarket,
    iconRight: icons.ArrowUpRight({
      width: 16,
      height: 16
    })
  }, "Browse the market")));
}
window.PortfolioScreen = PortfolioScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketplace/PortfolioScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketplace/app.jsx
try { (() => {
function App() {
  const {
    Dialog,
    Button,
    Notification
  } = window.TokenableDesignSystem_8d023b;
  const {
    fmt,
    icons
  } = window.TKData;
  const [route, setRoute] = React.useState("market");
  const [active, setActive] = React.useState(null);
  const [faves, setFaves] = React.useState(new Set([8]));
  const [buying, setBuying] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const nav = r => {
    setRoute(r);
    window.scrollTo(0, 0);
  };
  const openCard = c => {
    setActive(c);
    setRoute("detail");
    window.scrollTo(0, 0);
  };
  const fav = id => setFaves(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const confirmBuy = () => {
    const c = buying;
    setBuying(null);
    setToast({
      title: "Purchase complete",
      msg: `${c.title} is now in your vault.`
    });
    setTimeout(() => setToast(null), 3600);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: "#0e0e0e"
    }
  }, /*#__PURE__*/React.createElement(MarketHeader, {
    route: route === "detail" ? "market" : route,
    onNavigate: nav
  }), route === "market" && /*#__PURE__*/React.createElement(MarketScreen, {
    onOpen: openCard,
    faves: faves,
    onFav: fav
  }), route === "detail" && active && /*#__PURE__*/React.createElement(DetailScreen, {
    card: active,
    onBack: () => nav("market"),
    faves: faves,
    onFav: fav,
    onBuy: setBuying
  }), route === "portfolio" && /*#__PURE__*/React.createElement(PortfolioScreen, {
    onOpenMarket: () => nav("market")
  }), route === "sell" && /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 560,
      margin: "80px auto",
      textAlign: "center",
      padding: "0 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      margin: "0 auto 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(64,91,255,0.12)",
      boxShadow: "inset 0 0 0 2px var(--brand-500)",
      color: "#7084ff"
    }
  }, icons.Box({
    width: 30,
    height: 30
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 28,
      fontWeight: 700,
      color: "#fff",
      margin: 0
    }
  }, "Sell from your vault"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 16,
      color: "#a7a9ac",
      lineHeight: 1.5,
      marginTop: 12
    }
  }, "Ship a card to a Tokenable vault or list one you already hold. Grading and insurance are handled for you."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      display: "flex",
      gap: 12,
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Start a listing"), /*#__PURE__*/React.createElement(Button, {
    variant: "neutral",
    onClick: () => nav("portfolio")
  }, "View vault"))), buying && /*#__PURE__*/React.createElement(Dialog, {
    open: true,
    title: "Confirm purchase",
    onClose: () => setBuying(null),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "subtle",
      onClick: () => setBuying(null)
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: confirmBuy,
      iconLeft: icons.Wallet({
        width: 16,
        height: 16
      })
    }, "Pay ", fmt(buying.price)))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      alignItems: "center",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 70,
      background: "#191919",
      overflow: "hidden",
      flexShrink: 0,
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: buying.img,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: "#fff",
      fontSize: 16
    }
  }, buying.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "#6d6e71",
      marginTop: 3
    }
  }, buying.grade, " \xB7 ", buying.set))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      paddingTop: 14,
      borderTop: "1px solid #2c2c2c",
      display: "flex",
      justifyContent: "space-between",
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#a7a9ac"
    }
  }, "Settles instantly from balance ", fmt(12400)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      color: "#fff"
    }
  }, fmt(buying.price)))), toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 200
    }
  }, /*#__PURE__*/React.createElement(Notification, {
    scheme: "positive",
    title: toast.title
  }, toast.msg)));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketplace/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketplace/data.js
try { (() => {
// Tokenable marketplace — sample data + icon set (Feather). Exposed on window.
(function () {
  const cards = [{
    id: 1,
    title: "Team Rocket's Nidoking ex",
    set: "SV Destined Rivals · 233/182",
    grade: "PSA 10",
    pop: "POP 3",
    price: 58000,
    change: 138,
    period: "1Y",
    img: "../../assets/cards/nidoking.jpg",
    cat: "Pokémon",
    listed: 2
  }, {
    id: 2,
    title: "Mega Dream ex Pikachu Special Art Rare",
    set: "M2A Japanese · 234/193 SAR",
    grade: "PSA 10",
    pop: "POP 20.0k",
    price: 4312,
    change: 793.8,
    period: "180d",
    img: "../../assets/cards/nidoking.jpg",
    cat: "Pokémon",
    listed: 5
  }, {
    id: 3,
    title: "Patrick Mahomes RC",
    set: "2017 Panini Prizm · #150",
    grade: "PSA 10",
    pop: "POP 412",
    price: 18900,
    change: 42.5,
    period: "1Y",
    img: "../../assets/cards/nidoking.jpg",
    cat: "Sports",
    listed: 1
  }, {
    id: 4,
    title: "Charizard Holo 1st Ed.",
    set: "Base Set · 4/102",
    grade: "PSA 9",
    pop: "POP 121",
    price: 32500,
    change: -6.2,
    period: "90d",
    img: "../../assets/cards/nidoking.jpg",
    cat: "Pokémon",
    listed: 3
  }, {
    id: 5,
    title: "Victor Wembanyama RC",
    set: "2023 Prizm Silver · #136",
    grade: "BGS 9.5",
    pop: "POP 88",
    price: 9450,
    change: 211.0,
    period: "1Y",
    img: "../../assets/cards/nidoking.jpg",
    cat: "Sports",
    listed: 7
  }, {
    id: 6,
    title: "Lugia Neo Genesis",
    set: "Neo Genesis · 9/111",
    grade: "PSA 10",
    pop: "POP 56",
    price: 21800,
    change: 18.4,
    period: "180d",
    img: "../../assets/cards/nidoking.jpg",
    cat: "Pokémon",
    listed: 2
  }, {
    id: 7,
    title: "Michael Jordan Fleer",
    set: "1986 Fleer · #57",
    grade: "PSA 8",
    pop: "POP 2.1k",
    price: 14200,
    change: -3.1,
    period: "90d",
    img: "../../assets/cards/nidoking.jpg",
    cat: "Sports",
    listed: 9
  }, {
    id: 8,
    title: "Umbreon VMAX Alt Art",
    set: "Evolving Skies · 215/203",
    grade: "PSA 10",
    pop: "POP 904",
    price: 1650,
    change: 64.7,
    period: "1Y",
    img: "../../assets/cards/nidoking.jpg",
    cat: "Pokémon",
    listed: 12
  }];
  const holdings = [{
    id: 8,
    title: "Umbreon VMAX Alt Art",
    grade: "PSA 10",
    qty: 2,
    cost: 1100,
    value: 1650
  }, {
    id: 1,
    title: "Team Rocket's Nidoking ex",
    grade: "PSA 10",
    qty: 1,
    cost: 41000,
    value: 58000
  }, {
    id: 5,
    title: "Victor Wembanyama RC",
    grade: "BGS 9.5",
    qty: 3,
    cost: 3000,
    value: 9450
  }];
  const fmt = n => "$" + n.toLocaleString("en-US");
  const pct = n => (n >= 0 ? "+" : "") + n.toFixed(n % 1 ? 1 : 0) + "%";

  // Pixel icon factory — maps to window.PixelIcon (assets/icons/pixel-icons.js)
  const pic = name => (p = {}) => window.PixelIcon({
    name,
    size: p.width || p.size || 20,
    color: p.color || "currentColor",
    style: p.style
  });
  const icons = {
    Search: pic("search"),
    SearchFull: pic("search"),
    Heart: pic("heart"),
    ArrowUpRight: pic("arrow-up-right"),
    TrendUp: pic("arrow-up-right"),
    Check: pic("check"),
    Shield: pic("shield"),
    Bell: pic("bell"),
    Grid: pic("grid"),
    Filter: pic("filter"),
    ChevronDown: pic("chevron-down"),
    ChevronLeft: pic("chevron-left"),
    Box: pic("box"),
    Wallet: pic("wallet"),
    Eth: pic("eth")
  };
  window.TKData = {
    cards,
    holdings,
    fmt,
    pct,
    icons
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketplace/data.js", error: String((e && e.message) || e) }); }

__ds_ns.FINALSYMBOLLOGO = __ds_scope.FINALSYMBOLLOGO;

__ds_ns.LOGO = __ds_scope.LOGO;

__ds_ns.SYMBOL = __ds_scope.SYMBOL;

__ds_ns.CollectibleCard = __ds_scope.CollectibleCard;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Notification = __ds_scope.Notification;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Search = __ds_scope.Search;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Slider = __ds_scope.Slider;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Accordion = __ds_scope.Accordion;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Divider = __ds_scope.Divider;

__ds_ns.DetailBar = __ds_scope.DetailBar;

__ds_ns.GNB = __ds_scope.GNB;

__ds_ns.Menu = __ds_scope.Menu;

__ds_ns.MobileNav = __ds_scope.MobileNav;

__ds_ns.Pagination = __ds_scope.Pagination;

__ds_ns.SecondaryBar = __ds_scope.SecondaryBar;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
