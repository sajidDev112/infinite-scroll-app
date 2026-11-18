/**
 * Demo content: 8 stories built from the images in ./images.
 * Focal points are normalized (0–1) image coordinates picked from each picture.
 * Text timing on scenes = share of the scene's scroll; on intros = seconds.
 */

// ---- text presets (design units are px on a 1920-wide screen) -------------------------
const shadow = { enabled: true, color: 'rgba(0,0,0,0.6)', blur: 22, x: 0, y: 3 };
const noShadow = { enabled: false, color: '#000000', blur: 0, x: 0, y: 0 };

const kicker = (content, o = {}) => ({
  content, fontFamily: 'Inter Variable', fontSize: 24, fontWeight: 600, letterSpacing: 0.32,
  textTransform: 'uppercase', color: '#ffffff', opacity: 0.85, width: 0.5, shadow, animationType: 'fadeIn', ...o,
});
const headline = (content, o = {}) => ({
  content, fontFamily: 'Playfair Display Variable', fontSize: 92, fontWeight: 500, lineHeight: 1.05,
  color: '#ffffff', width: 0.55, shadow, animationType: 'slideUp', ...o,
});
const body = (content, o = {}) => ({
  content, fontFamily: 'Inter Variable', fontSize: 38, fontWeight: 400, lineHeight: 1.45,
  color: '#f5f3ee', width: 0.36, shadow, animationType: 'slideUp', ...o,
});
const card = (content, o = {}) => ({
  content, fontFamily: 'Inter Variable', fontSize: 34, fontWeight: 400, lineHeight: 1.5, color: '#ffffff',
  backgroundType: 'solid', backgroundColor: '#0b0b10', backgroundOpacity: 0.62, padding: 36, borderRadius: 20,
  width: 0.34, shadow: noShadow, animationType: 'slideUp', ...o,
});
const glass = (content, o = {}) => ({
  content, fontFamily: 'Inter Variable', fontSize: 34, fontWeight: 500, lineHeight: 1.45, color: '#ffffff',
  backgroundType: 'gradient', backgroundGradient: { from: '#1e1b4b', to: '#7c3aed', angle: 135 }, backgroundOpacity: 0.72,
  padding: 34, borderRadius: 22, width: 0.33, shadow: noShadow, animationType: 'slideLeft', ...o,
});
const quote = (content, o = {}) => ({
  content, fontFamily: 'Cormorant Garamond Variable', fontSize: 70, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.15,
  color: '#fff7e6', width: 0.5, shadow, animationType: 'fadeIn', ...o,
});
const poster = (content, o = {}) => ({
  content, fontFamily: 'Bebas Neue', fontSize: 168, fontWeight: 400, letterSpacing: 0.03, lineHeight: 0.95,
  color: '#ffffff', width: 0.6, shadow, animationType: 'scaleIn', ...o,
});

// Intro presets (timing in seconds)
// Intro: centered like a title card; the share icons + museum logo sit underneath.
const introKicker = (content, o = {}) => kicker(content, { animationDuration: 0.9, animationDelay: 0.2, textAlignment: 'center', width: 0.6, positionX: 0.2, positionY: 0.17, ...o });
const introTitle = (content, o = {}) => headline(content, { fontSize: 120, width: 0.84, textAlignment: 'center', animationDuration: 1.3, animationDelay: 0.45, easing: 'expo.out', positionX: 0.08, positionY: 0.22, ...o });
const introSub = (content, o = {}) => body(content, { fontSize: 34, width: 0.5, textAlignment: 'center', opacity: 0.9, animationDuration: 1.1, animationDelay: 1.1, positionX: 0.25, positionY: 0.52, ...o });

// Step shorthand: progress, zoom, focal [x,y], texts, options
const S = (progress, zoom, [x, y], texts = [], o = {}) => ({ progress, zoom, x, y, tx: o.tx ?? 0.5, ty: o.ty ?? 0.5, easing: o.easing || 'power2.inOut', move: o.move ?? 1, texts });
const at = (x, y) => ({ positionX: x, positionY: y });

export const STORIES = [
  // 1 ── single image ──────────────────────────────────────────────────────────────
  {
    title: "The Weaver's Afternoon",
    description: 'One painting, one quiet room: a master weaver at his loom, and every small thing he keeps close.',
    category: 'Miniature Painting',
    cover: 'weaver',
    intro: {
      image: 'weaver', overlayColor: '#0c0904', overlayOpacity: 0.55,
      texts: [
        introKicker('A single painting · 1 scene'),
        introTitle("The Weaver's\nAfternoon"),
        introSub('Scroll slowly. The camera will walk you through the room, one detail at a time.'),
      ],
    },
    scenes: [{
      image: 'weaver', scrollLength: 6, title: 'The loom room',
      steps: [
        S(0, 1, [0.5, 0.16], [kicker('A whitewashed room', at(0.07, 0.62)), body('Light falls through a carved stone screen. A blue cloth hangs from a peg, waiting.', at(0.07, 0.68))]),
        S(0.22, 1.7, [0.49, 0.49], [headline('The weaver pauses.', { ...at(0.07, 0.62), fontSize: 80, width: 0.4 }), body('Chin on his arm, he studies the pattern growing under his hands.', { ...at(0.07, 0.75), width: 0.32 })], { tx: 0.66 }),
        S(0.46, 2.7, [0.4, 0.645], [card('Each coloured bobbin carries one thread. He knots them in by hand, row after row — a few centimetres a day.', at(0.58, 0.58))], { tx: 0.33 }),
        S(0.7, 1.9, [0.62, 0.72], [glass('Borders of saffron and leaf-green slowly turn into a carpet that will outlive its maker.', { ...at(0.06, 0.12), animationType: 'slideRight' })], { tx: 0.62, ty: 0.6 }),
        S(1, 1.15, [0.6, 0.9], [quote('Slippers by the door,\nthe hookah still warm.', { ...at(0.07, 0.1), width: 0.6 })], { ty: 0.62 }),
      ],
    }],
  },

  // 2 ── single image ──────────────────────────────────────────────────────────────
  {
    title: 'The Mountain on His Finger',
    description: 'A storm, an angry god, and a boy who lifts a hill to shelter a whole village. A Pahari painting, read up close.',
    category: 'Mythology',
    cover: 'govardhan',
    intro: {
      image: 'govardhan', overlayColor: '#05060a', overlayOpacity: 0.6,
      texts: [
        introKicker('From the Bhagavata Purana'),
        introTitle('The Mountain\non His Finger'),
        introSub('When the rains would not stop, the people of Vraja found shelter in the strangest place.'),
      ],
    },
    scenes: [{
      image: 'govardhan', scrollLength: 7, title: 'Govardhan',
      steps: [
        S(0, 1, [0.5, 0.12], [poster('THE SKY\nTURNED BLACK', at(0.06, 0.55))]),
        S(0.2, 2.6, [0.86, 0.07], [card('Indra, king of the heavens, rode out on his white elephant and sent rain to drown the cowherds who had stopped worshipping him.', { ...at(0.06, 0.55), width: 0.36 })], { tx: 0.72, ty: 0.35 }),
        S(0.4, 1.35, [0.4, 0.22], [headline('So a boy lifted a mountain.', { ...at(0.07, 0.66), fontSize: 84 })]),
        S(0.6, 2.5, [0.42, 0.4], [glass('Krishna balanced Govardhan hill on the little finger of his left hand — and held it there for seven days.', at(0.6, 0.55))], { tx: 0.34 }),
        S(0.8, 1.7, [0.45, 0.83], [body('Beneath it waited everyone he loved: families, elders, children, and the cattle that were their whole wealth.', { ...at(0.07, 0.08), width: 0.42 })], { ty: 0.62 }),
        S(1, 1, [0.5, 0.5], [quote('Faith, the painting says,\nis a kind of shelter.', { ...at(0.07, 0.72), width: 0.6, backgroundType: 'solid', backgroundColor: '#000000', backgroundOpacity: 0.45, padding: 28, borderRadius: 16 })]),
      ],
    }],
  },

  // 3 ── single image ──────────────────────────────────────────────────────────────
  {
    title: 'Waiting in the Monsoon Grove',
    description: 'A ragamala painting turns a melody into a scene: a woman, a garland, and peacocks calling for rain.',
    category: 'Miniature Painting',
    cover: 'ragini-peacocks',
    intro: {
      image: 'ragini-peacocks', overlayColor: '#0a1206', overlayOpacity: 0.5,
      texts: [
        introKicker('Ragamala · music made visible'),
        introTitle('Waiting in the\nMonsoon Grove', { fontFamily: 'Cormorant Garamond Variable', fontStyle: 'italic', fontSize: 132 }),
        introSub('In a ragamala, every painting is a raga. Every detail is a note.'),
      ],
    },
    scenes: [{
      image: 'ragini-peacocks', scrollLength: 6, title: 'The grove',
      steps: [
        S(0, 1, [0.5, 0.1], [kicker('Dusk, before the rain', at(0.07, 0.66)), body('Birds cross a slate-blue sky. The trees are heavy with blossom.', at(0.07, 0.72))]),
        S(0.25, 2.3, [0.49, 0.4], [quote('She carries a garland\nfor someone who has not come.', { ...at(0.06, 0.62), width: 0.48 })], { tx: 0.7, ty: 0.42 }),
        S(0.5, 1.6, [0.4, 0.68], [card('Peacocks dance only when the clouds gather — the painter places them at her feet like a promise of the monsoon.', at(0.6, 0.56))], { tx: 0.35 }),
        S(0.75, 2.4, [0.7, 0.86], [glass('Look closer: a peacock strikes at a snake. Even in a love song, the forest keeps its own drama.', { ...at(0.06, 0.1), animationType: 'slideRight' })], { tx: 0.65, ty: 0.62 }),
        S(1, 1.6, [0.14, 0.9], [body('Ducks drift on the dark pond, in pairs — of course.', { ...at(0.48, 0.12), width: 0.4, textAlignment: 'right' })], { tx: 0.3, ty: 0.66 }),
      ],
    }],
  },

  // 4 ── multiple images ───────────────────────────────────────────────────────────
  {
    title: 'Miniature Worlds',
    description: 'Three paintings, three ways of seeing: a palace full of life, a portrait of power, and a forest that sings.',
    category: 'Miniature Painting',
    cover: 'krishna-forest',
    intro: {
      image: 'palace-courtyard', overlayColor: '#120804', overlayOpacity: 0.58,
      texts: [
        introKicker('3 paintings · 3 scenes'),
        introTitle('Miniature\nWorlds'),
        introSub('Painted with brushes of a single squirrel hair, these worlds were meant to be held close. Let us zoom in.'),
      ],
    },
    scenes: [
      {
        image: 'palace-courtyard', scrollLength: 5, title: 'The palace courtyard',
        steps: [
          S(0, 1, [0.5, 0.18], [kicker('Scene 1 · The palace', at(0.07, 0.62)), body('Pavilions, arcades and rooftops, all seen at once — Mughal painters ignored a single viewpoint.', at(0.07, 0.68))]),
          S(0.35, 2.3, [0.35, 0.45], [headline('A dancer turns.', { ...at(0.58, 0.62), fontSize: 80, width: 0.38 })], { tx: 0.32 }),
          S(0.68, 2.1, [0.18, 0.66], [card('Below the music, the kitchen never stops: a cook stirs a great cauldron while firewood waits on the floor.', at(0.58, 0.55))], { tx: 0.3 }),
          S(1, 1.3, [0.5, 0.82], [body('Life, stacked layer upon layer.', { ...at(0.07, 0.12), fontSize: 46, width: 0.5 })], { ty: 0.62 }),
        ],
      },
      {
        image: 'prince-portrait', scrollLength: 5, title: 'Portrait of a noble',
        steps: [
          S(0, 1, [0.5, 0.3], [kicker('Scene 2 · The portrait', at(0.07, 0.66)), body('Set against a jade sky and flowering cypresses, a nobleman sits for posterity.', at(0.07, 0.72))]),
          S(0.35, 2.4, [0.6, 0.35], [quote('Always in profile —\nthe angle of authority.', { ...at(0.06, 0.6), width: 0.42 })], { tx: 0.68, ty: 0.42 }),
          S(0.68, 2.6, [0.76, 0.53], [glass('He holds a single flower like a jewel: a sign of refinement as much as power.', at(0.06, 0.58))], { tx: 0.66 }),
          S(1, 2, [0.55, 0.53], [card('Pearls, rubies and emeralds were painted with real gold and raised white dots, so they would catch the light.', { ...at(0.62, 0.55), width: 0.32 })], { tx: 0.3 }),
        ],
      },
      {
        image: 'krishna-forest', scrollLength: 5, title: 'The singing forest',
        steps: [
          S(0, 1, [0.5, 0.45], [kicker('Scene 3 · The forest', at(0.07, 0.08)), headline('Under monsoon clouds', { ...at(0.07, 0.13), fontSize: 72 })]),
          S(0.35, 2.4, [0.49, 0.52], [card('Krishna dances at the centre, haloed in gold. The gopis gather, the cows turn their heads to listen.', at(0.06, 0.58))], { tx: 0.66 }),
          S(0.68, 2.2, [0.39, 0.7], [glass('A peacock fans its tail in answer — the forest itself is part of the song.', { ...at(0.6, 0.12), animationType: 'slideDown' })], { tx: 0.35, ty: 0.6 }),
          S(1, 1, [0.5, 0.5], [quote('Every tree is painted leaf by leaf.', { ...at(0.07, 0.8), width: 0.7, fontSize: 60 })]),
        ],
      },
    ],
  },

  // 5 ── multiple images ───────────────────────────────────────────────────────────
  {
    title: 'Towers of a Thousand Gods',
    description: 'The gopuram — the great gateway tower of a South Indian temple — seen from a distance, then tier by tier, face to face.',
    category: 'Temple Architecture',
    cover: 'gopuram-tiers',
    intro: {
      image: 'gopuram-wall', overlayColor: '#1a0a14', overlayOpacity: 0.55,
      texts: [
        introKicker('Temple architecture · 5 scenes'),
        introTitle('Towers of a\nThousand Gods', { fontFamily: 'Bebas Neue', fontSize: 168, lineHeight: 0.92, letterSpacing: 0.02, fontWeight: 400 }),
        introSub('A gopuram is a mountain made by hand. Climb it with your scroll wheel.'),
      ],
    },
    scenes: [
      {
        image: 'gopuram-arch', scrollLength: 4, title: 'First sight',
        steps: [
          S(0, 1, [0.5, 0.35], [kicker('Scene 1 · Approach', at(0.06, 0.64)), body('Framed by a plain grey arch, the tower rises like a coloured flame.', at(0.06, 0.7))], { tx: 0.6 }),
          S(0.5, 2.2, [0.54, 0.31], [headline('The face of glory', { ...at(0.06, 0.62), fontSize: 76, width: 0.4 }), body('A fanged kirtimukha guards the summit, warding evil away from the gate.', { ...at(0.06, 0.74), width: 0.32 })], { tx: 0.68 }),
          S(1, 1.8, [0.5, 0.62], [card('Below, gods and devotees sit in rows, each tier smaller than the one beneath.', at(0.06, 0.6))], { tx: 0.66 }),
        ],
      },
      {
        image: 'gopuram-wall', scrollLength: 4, title: 'A wall of figures',
        steps: [
          S(0, 1, [0.5, 0.5], [poster('HUNDREDS\nOF FIGURES', { ...at(0.06, 0.58), fontSize: 150 })]),
          S(0.55, 2.5, [0.53, 0.47], [glass('Dancers, sages, guardians and gods — every one hand-moulded in stucco and repainted every few years.', at(0.06, 0.58))], { tx: 0.68 }),
          S(1, 1.6, [0.53, 0.75], [body('Pastel pinks and mint greens: the colours of renewal.', { ...at(0.06, 0.1), width: 0.4 })], { ty: 0.62 }),
        ],
      },
      {
        image: 'gopuram-crown', scrollLength: 3.5, title: 'The crown',
        steps: [
          S(0, 1, [0.5, 0.35], [kicker('Scene 3 · The crown', at(0.06, 0.7)), body('Gilded finials, the kalasha, line the very top.', at(0.06, 0.76))]),
          S(1, 2.6, [0.66, 0.31], [headline('Fangs, horns\nand a watchful stare.', { ...at(0.06, 0.58), fontSize: 72, width: 0.42 })], { tx: 0.7 }),
        ],
      },
      {
        image: 'gopuram-peacock', scrollLength: 3.5, title: 'The peacock gate',
        steps: [
          S(0, 1, [0.5, 0.45], [kicker('Scene 4 · Colour', at(0.06, 0.1)), headline('Nothing here is shy.', { ...at(0.06, 0.15), fontSize: 76 })]),
          S(1, 2.4, [0.6, 0.85], [card('A painted peacock — vehicle of Murugan — watches from the doorway, its blues as bright as the sky.', at(0.06, 0.12))], { tx: 0.66, ty: 0.62 }),
        ],
      },
      {
        image: 'gopuram-tiers', scrollLength: 4, title: 'Tier by tier',
        steps: [
          S(0, 1, [0.5, 0.25], [kicker('Scene 5 · Tier by tier', at(0.06, 0.66)), body('Each level is a storey of heaven, crowded with its residents.', at(0.06, 0.72))]),
          S(0.55, 2.3, [0.56, 0.55], [glass('Painted faces, jewelled crowns, a raised hand: every figure blesses whoever walks beneath.', at(0.06, 0.58))], { tx: 0.68 }),
          S(1, 1.2, [0.5, 0.75], [quote('To enter, you pass under all of them.', { ...at(0.06, 0.12), width: 0.6 })], { ty: 0.62 }),
        ],
      },
    ],
  },

  // 6 ── multiple images ───────────────────────────────────────────────────────────
  {
    title: 'Faces of the Divine',
    description: 'Carved in wood, cast in stucco, painted larger than life — three ways artisans give the gods a face.',
    category: 'Sculpture',
    cover: 'guardian-statue',
    intro: {
      image: 'five-faced-deity', overlayColor: '#0d0612', overlayOpacity: 0.55,
      texts: [
        introKicker('Sculpture · 3 scenes'),
        introTitle('Faces of\nthe Divine'),
        introSub('Look them in the eye.'),
      ],
    },
    scenes: [
      {
        image: 'wood-carvings', scrollLength: 4.5, title: 'Carved in wood',
        steps: [
          S(0, 1, [0.5, 0.5], [kicker('Scene 1 · Wood', at(0.06, 0.08)), headline('Shaped by chisel and patience', { ...at(0.06, 0.13), fontSize: 66, width: 0.5 })]),
          S(0.33, 2.3, [0.22, 0.46], [card('Ganesha, remover of obstacles, appears first — as he does at the start of every undertaking.', at(0.6, 0.56))], { tx: 0.33 }),
          S(0.66, 2.2, [0.52, 0.14], [glass('Above him, a playful Krishna with his flute, every bead of his jewellery cut by hand.', { ...at(0.06, 0.58), animationType: 'slideRight' })], { tx: 0.66 }),
          S(1, 2, [0.78, 0.66], [body('A serene face, polished by touch.', { ...at(0.06, 0.12), fontSize: 46, width: 0.4 })], { tx: 0.6, ty: 0.58 }),
        ],
      },
      {
        image: 'five-faced-deity', scrollLength: 4, title: 'Five faces',
        steps: [
          S(0, 1, [0.5, 0.5], [kicker('Scene 2 · Stucco', at(0.06, 0.1)), body('Five faces turn as one, looking out in every direction at once.', { ...at(0.06, 0.15), width: 0.4 })]),
          S(0.5, 2, [0.5, 0.42], [headline('All-seeing.', { ...at(0.06, 0.74), fontSize: 96 })], { ty: 0.4 }),
          S(1, 2.5, [0.56, 0.66], [card('A raised palm — abhaya mudra — means "do not fear".', { ...at(0.6, 0.12), width: 0.3 })], { tx: 0.35, ty: 0.6 }),
        ],
      },
      {
        image: 'guardian-statue', scrollLength: 5, title: 'The guardian',
        steps: [
          S(0, 1, [0.5, 0.24], [kicker('Scene 3 · The guardian', at(0.06, 0.66)), body('Towering above the temple wall, a village guardian deity keeps watch.', at(0.06, 0.72))]),
          S(0.35, 2, [0.5, 0.43], [poster('EYES\nWIDE OPEN', { ...at(0.06, 0.55), fontSize: 150, width: 0.4 })], { tx: 0.68 }),
          S(0.7, 1.7, [0.52, 0.6], [glass('Gold chains, a broad sash, a sword in one hand and a staff in the other: ready for whatever comes down the road.', at(0.62, 0.55))], { tx: 0.34 }),
          S(1, 1, [0.5, 0.5], [quote('He has never once looked away.', { ...at(0.06, 0.82), width: 0.6, fontSize: 62 })]),
        ],
      },
    ],
  },

  // 7 ── multiple images ───────────────────────────────────────────────────────────
  {
    title: 'When Gods Dance',
    description: 'In Kerala and beyond, the divine does not stay in the shrine — it walks, dances and rolls through the streets.',
    category: 'Festivals',
    cover: 'theyyam',
    intro: {
      image: 'theyyam', overlayColor: '#1a0303', overlayOpacity: 0.5,
      texts: [
        introKicker('Ritual & festival · 3 scenes', { color: '#ffd7c2' }),
        introTitle('When Gods\nDance', { fontFamily: 'Bebas Neue', fontSize: 172, lineHeight: 0.9, fontWeight: 400 }),
        introSub('For one night, a performer becomes a god. The village comes to meet them.'),
      ],
    },
    scenes: [
      {
        image: 'theyyam', scrollLength: 5, title: 'Theyyam',
        steps: [
          S(0, 1, [0.5, 0.2], [kicker('Scene 1 · Theyyam', at(0.06, 0.64)), body('A crown of red and silver fans out like flames.', at(0.06, 0.7))]),
          S(0.4, 2.4, [0.44, 0.41], [headline('Not a costume.\nA presence.', { ...at(0.06, 0.6), fontSize: 80, width: 0.4 })], { tx: 0.66 }),
          S(1, 1.5, [0.5, 0.66], [card('Body paint, fresh garlands, bangles of red thread: the dancer prepares for hours before the deity "arrives".', at(0.6, 0.12))], { tx: 0.35, ty: 0.58 }),
        ],
      },
      {
        image: 'festival-masks', scrollLength: 4.5, title: 'Masks in procession',
        steps: [
          S(0, 1, [0.5, 0.45], [kicker('Scene 2 · Procession', at(0.06, 0.08)), headline('Faces bigger than people', { ...at(0.06, 0.13), fontSize: 70 })]),
          S(0.35, 2.4, [0.24, 0.42], [glass('Silver eyes, lolling tongue, curling moustache — the masks are meant to be seen from the back of the crowd.', at(0.6, 0.56))], { tx: 0.33 }),
          S(0.7, 2.2, [0.55, 0.72], [card('In the middle of it all, a young performer in red and gold, perfectly still.', at(0.06, 0.12))], { tx: 0.62, ty: 0.6 }),
          S(1, 1.8, [0.86, 0.66], [body('…and, of course, everyone is filming.', { ...at(0.06, 0.12), fontSize: 46, width: 0.45 })], { tx: 0.6 }),
        ],
      },
      {
        image: 'chariot-bw', scrollLength: 4.5, title: 'The chariot', fit: 'cover',
        steps: [
          S(0, 1, [0.55, 0.45], [kicker('Scene 3 · The chariot', at(0.06, 0.1)), body('Before the festival, the great wooden chariot rests by the road.', { ...at(0.06, 0.15), width: 0.4 })]),
          S(0.5, 2.1, [0.37, 0.7], [quote('An old man stops,\nand touches the wheel.', { ...at(0.55, 0.12), width: 0.42 })], { tx: 0.3, ty: 0.62 }),
          S(1, 1.6, [0.72, 0.45], [card('Carved lions hold up the deck. In a few days, thousands of hands will pull this chariot through the streets.', at(0.06, 0.58))], { tx: 0.7 }),
        ],
      },
    ],
  },

  // 8 ── multiple images ───────────────────────────────────────────────────────────
  {
    title: 'Colours of the Street',
    description: 'From a village tradition painted with twigs to a café mural and a gallery doorway — art that lives where people do.',
    category: 'Folk & Modern',
    cover: 'hoi-an-gallery',
    intro: {
      image: 'cubist-mural', overlayColor: '#0a0a14', overlayOpacity: 0.5,
      texts: [
        introKicker('Folk & modern · 3 scenes'),
        introTitle('Colours of\nthe Street', { color: '#fff1d6' }),
        introSub('Art does not only hang in museums. Sometimes it hangs in a doorway.'),
      ],
    },
    scenes: [
      {
        image: 'madhubani', scrollLength: 4.5, title: 'Madhubani',
        steps: [
          S(0, 1, [0.53, 0.5], [kicker('Scene 1 · Madhubani', at(0.06, 0.08)), body('From Mithila in Bihar: no empty space, ever.', { ...at(0.06, 0.13), width: 0.4 })]),
          S(0.5, 2.2, [0.52, 0.3], [glass('A wedding: bride and groom framed by a canopy of dots, lotuses and lines — painted traditionally with twigs and natural pigments.', at(0.06, 0.56))], { tx: 0.68 }),
          S(1, 2, [0.12, 0.42], [card('Next to it, a goddess sits on coiled serpents.', { ...at(0.6, 0.12), width: 0.3 })], { tx: 0.3 }),
        ],
      },
      {
        image: 'cubist-mural', scrollLength: 4, title: 'The café mural',
        steps: [
          S(0, 1, [0.5, 0.5], [poster('MUSIC IN\nSHARP ANGLES', { ...at(0.06, 0.6), fontSize: 132 })]),
          S(0.5, 2.3, [0.4, 0.1], [body('A blue dancer tips her head back, eyes closed.', { ...at(0.06, 0.62), fontSize: 44, width: 0.36 })], { tx: 0.68, ty: 0.35 }),
          S(1, 2.2, [0.67, 0.77], [glass('Below, another face, calm as a mask — the cubists borrowed from Indian and African art; here India borrows back.', { ...at(0.06, 0.12), animationType: 'slideRight' })], { tx: 0.66, ty: 0.6 }),
        ],
      },
      {
        image: 'hoi-an-gallery', scrollLength: 5, title: 'A gallery doorway',
        steps: [
          S(0, 1, [0.55, 0.18], [kicker('Scene 3 · Hoi An', at(0.06, 0.66)), body('Half a world away, lanterns sway over a shopfront gallery.', at(0.06, 0.72))]),
          S(0.35, 2.2, [0.29, 0.58], [card('Lotus buds stacked like a bouquet, each petal built up in thick paint.', at(0.6, 0.56))], { tx: 0.33 }),
          S(0.7, 2.2, [0.63, 0.66], [glass('A street of glowing lanterns — a painting of the street it hangs on.', { ...at(0.06, 0.58), animationType: 'slideRight' })], { tx: 0.66 }),
          S(1, 1, [0.5, 0.5], [quote('Wherever people gather,\nthey paint.', { ...at(0.06, 0.74), width: 0.6, fontSize: 60, backgroundType: 'solid', backgroundColor: '#000000', backgroundOpacity: 0.4, padding: 26, borderRadius: 14 })]),
        ],
      },
    ],
  },
];
