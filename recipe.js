/* =====================================================================
   recipe.js  —  ALL editable content and timing lives here.

   Timeline is in seconds on a fixed 30-second clock.
   Each step has:
     at    : start time (s)
     dur   : duration (s)
     kind  : what the renderer animates
             leaf | bigice | mixice | pour | dash | stir | strain | garnish | hero
     label : primary caption (ingredient or action name)
     amount: measurement shown next to the label (optional)
     detail: secondary line (optional)
     oz    : liquid volume added to the mixing glass (pour kinds only)
     color : ingredient colour used for the pour stream and the blend
     tint  : small volume-equivalent used for colour blending of dashes

   Keep step windows non-overlapping and inside [3, 25] for the build
   phase so the 0–3 intro and 25–30 reveal hold their contract.
   ===================================================================== */

window.RECIPE = {
  duration: 30,              // total seconds (must stay 30 for the brief)
  fps: 30,                   // capture frame rate used by render.py
  width: 1080,
  height: 1080,

  title: "Ni de Aquí\nNi de Allá",
  suffix: "with Claude",
  translation: "Neither from here nor from there",
  credit: "Danny González & Pedro Tobar · Bar Providencia, Washington, D.C.",
  tagline: "Salvadoran and Taiwanese influences in one glass",
  glass: "Rocks glass",
  garnish: "Fresh banana leaf",

  // Ingredient palette (sRGB hex). Blend is volume-weighted in the renderer.
  colors: {
    bourbon:  "#a8551a",
    mezcal:   "#cdb06a",
    plantain: "#6e3410",
    angostura:"#4a160f",
    banana:   "#d9a833"
  },

  steps: [
    // ---- intro 0–3 is implicit (title card + empty glass) ----

    { id: "leaf",     at: 3.0,  dur: 2.5, kind: "leaf",
      label: "Prep the glass",
      detail: "Line a rocks glass with a trimmed banana leaf" },

    { id: "bigice",   at: 5.5,  dur: 2.0, kind: "bigice",
      label: "Large ice cube", amount: "1",
      detail: "Place one large cube inside the lined glass" },

    { id: "mixice",   at: 7.5,  dur: 1.5, kind: "mixice",
      label: "Mixing glass",
      detail: "Fill with ice" },

    { id: "bourbon",  at: 9.0,  dur: 2.5, kind: "pour",
      label: "Bourbon", amount: "1 oz", oz: 1.0, color: "bourbon" },

    { id: "mezcal",   at: 11.5, dur: 2.5, kind: "pour",
      label: "Mezcal", amount: "1 oz", oz: 1.0, color: "mezcal" },

    { id: "plantain", at: 14.0, dur: 2.5, kind: "pour",
      label: "Plantain syrup", amount: "½ oz", oz: 0.5, color: "plantain",
      detail: "Spiced: fried plantain, cinnamon, toasted coriander" },

    { id: "angostura", at: 16.5, dur: 2.0, kind: "dash",
      label: "Angostura bitters", amount: "2 dashes", dashes: 2,
      color: "angostura", tint: 0.06 },

    { id: "banana",   at: 18.5, dur: 2.0, kind: "dash",
      label: "Banana bitters", amount: "2 dashes", dashes: 2,
      color: "banana", tint: 0.06 },

    { id: "stir",     at: 20.5, dur: 2.3, kind: "stir",
      label: "Stir",
      detail: "Until thoroughly chilled" },

    { id: "strain",   at: 22.8, dur: 2.2, kind: "strain",
      label: "Strain",
      detail: "Directly into the prepared rocks glass" },

    // ---- reveal 25–30 ----
    { id: "garnish",  at: 25.0, dur: 2.0, kind: "garnish",
      label: "Garnish", detail: "Fresh banana leaf" },

    { id: "hero",     at: 27.0, dur: 3.0, kind: "hero" }
  ]
};
