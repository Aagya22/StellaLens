export interface Product {
  id: string;
  name: string;
  category: 'earrings' | 'necklaces' | 'rings' | 'bracelets';
  price: string;
  description: string;
  modelPath: string;
  arEnabled: boolean;
  image: string;
  customizeColors?: boolean;
  modelRotation?: [number, number, number];
  pair?: boolean;

  pairMirror?: 'flipX' | 'rotateY';

  preserveMaterials?: boolean;

  earAnchor?: {
    userRight: { lateral: number; down: number; back: number };
    userLeft: { lateral: number; down: number; back: number };
  };
  necklaceStyle?: 'full' | 'pendant';
  necklaceStrip?: string[];

  metalOptions?: boolean;

  ringFit?: {
    alongT?: number;
    sizeCm?: number;
    liftCm?: number;
    tiltDamp?: number;
    gemFlip?: boolean;
  };

  braceletFit?: {
    loose?: number;
    offsetCm?: number;
    wristCm?: number;
    tiltDeg?: number;
  };
  necklaceAnchor?: {
    pivotOffset?: { x?: number; y?: number; z?: number };

    dropCm?: number;

    forwardCm?: number;

    widthCm?: number;

    lengthCm?: number;

    pendantCm?: number;

    occRxCm?: number;
    occRzCm?: number;
    occHCm?: number;
    yawFollow?: number;
    pitchFollow?: number;
    rollFollow?: number;
  };

  dangle?: {
    stiffness?: number;
    damping?: number;
    maxSwingDeg?: number;
    response?: number;
    pivotDrop?: number;
    yawFollow?: number;
    accelDeadZone?: number;
  };

  skinPenetration?: number;

  contactShadow?: number;

  arType?: 'dangle' | 'hoop' | 'stud';

  fixedNodes?: string[];

  arFit?: {
    rotationDeg?: [number, number, number];
    scale?: number;
  };

  arMaterials?: Array<{
    match: string;
    hide?: boolean;
    color?: string;
    metalness?: number;
    roughness?: number;
    clearcoat?: number;
    clearcoatRoughness?: number;
    envMapIntensity?: number;
  }>;
}

export const PRODUCTS: Product[] = [
  {
    id: "earring_diamond",
    name: "Astraea Diamond Drops",
    category: "earrings",
    price: "Rs 1,250",
    description: "A brilliant-cut ruby stud above a tanzanite teardrop, ringed in pavé diamonds and set in 24k gold.",
    modelPath: "/models/earrings/astraea_diamond_drops.glb",
    arEnabled: true,
    image: "/images/earrings1.png",
    customizeColors: true,
    modelRotation: [90, 0, 0],
    pair: true,
    preserveMaterials: true,
    arType: 'dangle',
    dangle: { stiffness: 120, damping: 18, maxSwingDeg: 5, response: 0.003, pivotDrop: 0.3, accelDeadZone: 80 },
    skinPenetration: 0.5,

    earAnchor: {
      userRight: { lateral: 0, down: 0, back: 0 },
      userLeft:  { lateral: 0, down: 0, back: 0 }
    }
  },
  {
    id: "earring_gold_hoop",
    name: "Lunette Golden Hoops",
    category: "earrings",
    price: "Rs 650",
    description: "Classic huggie hoops forged from solid 18k yellow gold, with a high-polish mirror finish and a comfort-fit clasp.",
    modelPath: "/models/earrings/gold_hoop_clean.glb",
    arEnabled: true,
    image: "/images/earrings2.png",

    pair: true,
    preserveMaterials: true,

    arType: 'hoop',
    arFit: { rotationDeg: [0, 0, 0], scale: 1.2 },
    skinPenetration: 0.5,
    earAnchor: {
      userRight: { lateral: 0, down: 0, back: 0 },
      userLeft:  { lateral: 0, down: 0, back: 0 }
    }
  },
  {
    id: "earring_selene",
    name: "Selene Studs",
    category: "earrings",
    price: "Rs 780",
    description: "Round studs in solid gold, sized to catch the light without the weight — the everyday pair.",
    modelPath: "/models/earrings/selene_studs.glb",
    arEnabled: true,
    image: "/images/products/selene-studs.png",
    preserveMaterials: true,
    arType: 'stud',
    skinPenetration: 1.5,
    contactShadow: 0.5,
    earAnchor: {
      userRight: { lateral: 0, down: 0, back: 0 },
      userLeft:  { lateral: 0, down: 0, back: 0 }
    },

    arMaterials: [
      { match: "plat",   color: "#D9B96A", metalness: 1.0,  roughness: 0.3, envMapIntensity: 1.4 },
      { match: "mat245", color: "#f7f4ee", metalness: 0.05, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25 }
    ]
  },
  {
    id: "earring_anarkali",
    name: "Anarkali Drops",
    category: "earrings",
    price: "Rs 1,050",
    description: "Layered gold drops in the Anarkali tradition, finished by hand.",
    modelPath: "/models/earrings/anarkali_earring.glb",
    arEnabled: true,
    image: "/images/anarkali.png",

    pair: true,
    preserveMaterials: true,
    arType: 'dangle',
    dangle: { pivotDrop: 0.3 },
    skinPenetration: 0.5,
    arFit: { rotationDeg: [0, 0, 0] },
    earAnchor: {
      userRight: { lateral: 0, down: 0, back: 0 },
      userLeft:  { lateral: 0, down: 0, back: 0 }
    }
  },
  {
    id: "earring_raflesia",
    name: "Raflesia Two-Layer Drops",
    category: "earrings",
    price: "Rs 1,180",
    description: "A two-tier floral drop earring, blooming in solid gold.",
    modelPath: "/models/earrings/raflesia_single.glb",
    arEnabled: true,
    image: "/images/raf.png",
    pair: true,
    preserveMaterials: true,
    arType: 'dangle',
    dangle: { pivotDrop: 0.3 },
    skinPenetration: 0.5,
    arFit: { rotationDeg: [0, 0, 0], scale: 1.6 },
    earAnchor: {
      userRight: { lateral: 0, down: 0, back: 0 },
      userLeft:  { lateral: 0, down: 0, back: 0 }
    }
  },
  {
    id: "necklace_orlaith",
    name: "Orlaith Celestial Chain",
    category: "necklaces",
    price: "Rs 1,800",
    description: "A statement collar hand-carved in solid 22k yellow gold, weighted to rest exactly where it should on the neck.",
    modelPath: "/models/necklaces/orlaith_celestial_chain.glb",
    arEnabled: true,
    image: "/images/orlaith.png",

    necklaceStrip: ['badan', 'shirley'],
    metalOptions: true,
    necklaceAnchor: {
      pivotOffset: { x: -0.2, z: -4.9 }, dropCm: 5.0,
      widthCm: 17, lengthCm: 17.3, forwardCm: 0,
      occRxCm: 6.2, occRzCm: 4.4,
    },
  },
  {
    id: "necklace_vega",
    name: "Vega Beaded Necklace",
    category: "necklaces",
    price: "Rs 1,250",
    description: "Hand-strung beads in black, white and red on a fine cord.",
    modelPath: "/models/necklaces/new.glb",
    arEnabled: true,
    image: "/images/products/vega-beads.png",
    preserveMaterials: true,
    necklaceStrip: ['shirley', 'polysurface1421'],
    necklaceAnchor: {
      pivotOffset: { x: 0.1, z: -4.0 }, dropCm: 5.4,
      widthCm: 14, forwardCm: 1.6,
      occRxCm: 5.7, occRzCm: 4.4,
    },
  },
  {
    id: "ring_polaris",
    name: "Polaris Solitaire",
    category: "rings",
    price: "Rs 2,400",
    description: "A brilliant-cut solitaire held in a four-prong crown, on a pavé-lined band made to measure.",
    modelPath: "/models/rings/polaris_solitaire.glb",
    arEnabled: true,
    image: "/images/products/polaris-solitaire.png",
    preserveMaterials: true,
    arFit: { rotationDeg: [0, 0, 90] },

    ringFit: { alongT: 0.62, sizeCm: 1.15 },
  },
  {
    id: "ring_rosanna",
    name: "Rosanna Pavé Band",
    category: "rings",
    price: "Rs 1,600",
    description: "A slender band traced with pavé-set stones, cast as a single piece and signed in gold.",
    modelPath: "/models/rings/rosanna_pave_band.glb",
    arEnabled: true,
    image: "/images/products/rosanna-band.png",
    preserveMaterials: true,
    arFit: { rotationDeg: [-136, 0, 0] },

    ringFit: { alongT: 0.5, sizeCm: 1.4, gemFlip: true },
  },
  {
    id: "ring_silver_moon",
    name: "Silver Moon Ring",
    category: "rings",
    price: "Rs 1,900",
    description: "A crescent-set band in moonlit silver, poised on the finger.",
    modelPath: "/models/rings/silver_moon_ring.glb",
    arEnabled: true,
    image: "/images/products/silver-moon-ring.png",
    preserveMaterials: true,

    ringFit: { alongT: 0.91, sizeCm: 1.2, liftCm: 0 },
  },
  {
    id: "bracelet_lyra",
    name: "Lyra Topaz Weave",
    category: "bracelets",
    price: "Rs 1,350",
    description: "Woven gold strands set with blue topaz, clasped in hand-polished gold.",
    modelPath: "/models/bracelets/lyra_topaz_weave.glb",
    arEnabled: true,
    image: "/images/products/lyra-weave.png",
    preserveMaterials: true,
    necklaceStrip: ['cube', 'velvet'],
    braceletFit: { loose: 1.15 },
  },
  {
    id: "bracelet_solene",
    name: "Solene Gold Bracelet",
    category: "bracelets",
    price: "Rs 1,250",
    description: "A smooth gold bracelet, sculpted to sit softly against the wrist.",
    modelPath: "/models/bracelets/gold_bracelet.glb",
    arEnabled: true,
    image: "/images/products/solene-bracelet.png",
    preserveMaterials: true,
    // Thicker band than the Lyra, so it needs a tighter hole to match its bulk.
    braceletFit: { loose: 1.0 },
  },
  {
    id: "necklace_elara",
    name: "Elara Layered Collar",
    category: "necklaces",
    price: "Rs 1,200",
    description: "A double strand that follows the collarbone, finished with a beaded drop at the front.",
    modelPath: "/models/necklaces/double_layer_collar_bone_necklace.glb",
    arEnabled: true,
    image: "/images/products/elara-chain.png",
    preserveMaterials: true,
    // group1 is the display bust; nothing else in the file matches that name.
    necklaceStrip: ['group1'],
    necklaceAnchor: {
      pivotOffset: { x: 0, z: -5.2 }, dropCm: 6.6,
      widthCm: 17, lengthCm: 17, forwardCm: 3.2,
      occRxCm: 5.8, occRzCm: 4.4,
    },
  },
  {
    id: "ring_doji",
    name: "Doji Diamond Ring",
    category: "rings",
    price: "Rs 2,100",
    description: "A raised diamond crown on a slender band, cut to catch light from every angle.",
    modelPath: "/models/rings/doji_diamond_ring.glb",
    arEnabled: true,
    image: "/images/products/doji-diamond-ring.png",
    preserveMaterials: true,
    ringFit: { alongT: 0.5, sizeCm: 1.2 },
  }
];
