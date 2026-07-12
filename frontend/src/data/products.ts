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
  /** Render the GLB's authored materials exactly as-is */
  preserveMaterials?: boolean;
  /** Per-model ear-anchor calibration (canonical cm).  */
  earAnchor?: {
    userRight: { lateral: number; down: number; back: number };
    userLeft: { lateral: number; down: number; back: number };
  };
  
  dangle?: {
    stiffness?: number;
    damping?: number;
    maxSwingDeg?: number;
    response?: number;
    pivotDrop?: number;
    yawFollow?: number;
  };
  
  skinPenetration?: number;
  /** AR fit per model: orientation correction (degrees, applied before the
      pivot is computed) and a size multiplier on the shared base scale */
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
    price: "$1,250",
    description: "A brilliant-cut ruby stud above a tanzanite teardrop, ringed in pavé diamonds and set in 24k gold.",
    modelPath: "/models/earrings/astraea_diamond_drops.glb",
    arEnabled: true,
    image: "/images/earrings1.png",
    customizeColors: true,
    modelRotation: [90, 0, 0],
    pair: true,
    preserveMaterials: true,
    // Hook levers slightly around the piercing at large swings
    dangle: { pivotDrop: 0.2 },      // dangler → default yawFollow 0.2
    skinPenetration: 0.5,            // hook tip into the lobe
    // Calibrated live 2026-07-12
    earAnchor: {
      userRight: { lateral: 7.8, down: 4.1, back: 4.2 },
      userLeft:  { lateral: 8.6, down: 4.0, back: 3.9 }
    }
  },
  {
    id: "earring_gold_hoop",
    name: "Lunette Golden Hoops",
    category: "earrings",
    price: "$650",
    description: "Classic huggie hoops forged from solid 18k yellow gold, with a high-polish mirror finish and a comfort-fit clasp.",
    modelPath: "/models/earrings/gold_hoop_clean.glb",
    arEnabled: true,
    image: "/images/earrings2.png",
    
    pair: true,
    preserveMaterials: true,
    
    arFit: { rotationDeg: [0, 0, 0], scale: 1.2 },
    skinPenetration: 0.5,
    // Calibrated live 2026-07-12
    earAnchor: {
      userRight: { lateral: 7.9, down: 1.8, back: 3.7 },
      userLeft:  { lateral: 8.9, down: 2.0, back: 3.8 }
    }
  },
  {
    id: "earring_selene",
    name: "Selene Studs",
    category: "earrings",
    price: "$780",
    description: "Round studs in solid gold, sized to catch the light without the weight — the everyday pair.",
    modelPath: "/models/earrings/selene_studs.glb",
    arEnabled: true,
    image: "/images/earrings1.png",
    preserveMaterials: true,
    // Studs are rigid to the lobe: full yaw follow, no swing.
    dangle: { yawFollow: 1.0, maxSwingDeg: 0 },
    skinPenetration: 1.5, // post fully hidden, gem sits flush on the lobe
    // Calibrated live 2026-07-12
    earAnchor: {
      userRight: { lateral: 8.6, down: 1.5, back: 3.5 },
      userLeft:  { lateral: 7.8, down: 1.8, back: 3.9 }
    },
    
    arMaterials: [
      { match: "plat",   color: "#D9B96A", metalness: 1.0,  roughness: 0.3, envMapIntensity: 1.4 },
      { match: "mat245", color: "#f7f4ee", metalness: 0.05, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25 }
    ]
  },
  {
    id: "earring_nova",
    name: "Nova Drops",
    category: "earrings",
    price: "$920",
    description: "Slender drop earrings in polished gold, made to move with every turn of the head.",
    modelPath: "/models/earrings/nova_drops.glb",
    arEnabled: true,
    image: "/images/earrings1.png",
    // The GLB is a SINGLE earring (cube + gem sphere + torus assembly).
    pair: true,
    preserveMaterials: true,
   
    arFit: { rotationDeg: [90, 90, 0], scale: 1.4 },
    skinPenetration: 0.5 // dangler → default yawFollow 0.2, hook tip into lobe
  },
  {
    id: "necklace_orlaith",
    name: "Orlaith Celestial Chain",
    category: "necklaces",
    price: "$1,800",
    description: "A statement collar hand-carved in solid 22k yellow gold, weighted to rest exactly where it should on the neck.",
    modelPath: "/models/necklaces/orlaith_celestial_chain.glb",
    arEnabled: true,
    image: "/images/necklace1.png"
  },
  {
    id: "necklace_locket",
    name: "Luna Locket",
    category: "necklaces",
    price: "$1,150",
    description: "A polished gold locket on a fine chain — a hidden place for whatever you carry with you.",
    modelPath: "/models/necklaces/luna_locket.glb",
    arEnabled: true,
    image: "/images/necklace1.png"
  },
  {
    id: "necklace_pearl",
    name: "Pleiades Pearl Strand",
    category: "necklaces",
    price: "$1,400",
    description: "A strand of cultured pearls knotted by hand, finished with a solid gold clasp.",
    modelPath: "/models/necklaces/pleiades_pearl_strand.glb",
    arEnabled: true,
    image: "/images/necklace1.png"
  },
  {
    id: "ring_polaris",
    name: "Polaris Solitaire",
    category: "rings",
    price: "$2,400",
    description: "A brilliant-cut solitaire held in a four-prong crown, on a pavé-lined band made to measure.",
    modelPath: "/models/rings/polaris_solitaire.glb",
    arEnabled: false,
    image: "/images/ring1.png"
  },
  {
    id: "ring_rosanna",
    name: "Rosanna Pavé Band",
    category: "rings",
    price: "$1,600",
    description: "A slender band traced with pavé-set stones, cast as a single piece and signed in gold.",
    modelPath: "/models/rings/rosanna_pave_band.glb",
    arEnabled: false,
    image: "/images/ring1.png"
  },
  {
    id: "bracelet_callisto",
    name: "Callisto Chain",
    category: "bracelets",
    price: "$980",
    description: "A cable-link chain bracelet in solid gold, sized to your wrist and closed with a toggle clasp.",
    modelPath: "/models/bracelets/callisto_chain.glb",
    arEnabled: false,
    image: "/images/bracelet1.png"
  },
  {
    id: "bracelet_lyra",
    name: "Lyra Topaz Weave",
    category: "bracelets",
    price: "$1,350",
    description: "Woven gold strands set with blue topaz, clasped in hand-polished gold.",
    modelPath: "/models/bracelets/lyra_topaz_weave.glb",
    arEnabled: false,
    image: "/images/bracelet1.png"
  }
];
