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
  /** Render the GLB's authored materials exactly as-is */
  preserveMaterials?: boolean;
  /** How this piece hangs off the lobe (canonical cm), not where the lobe is.
      Keep symmetric — the engine mirrors it. */
  earAnchor?: {
    userRight: { lateral: number; down: number; back: number };
    userLeft: { lateral: number; down: number; back: number };
  };
  necklaceStyle?: 'full' | 'pendant';
  necklaceStrip?: string[];
  /** Show the gold/silver metal-tone toggle in the AR view */
  metalOptions?: boolean;
  /** Ring placement on the ring finger (see rings.ts RING_FIT) */
  ringFit?: {
    alongT?: number;   // 0 = knuckle, 1 = first joint
    sizeCm?: number;   // ring size as a multiple of on-screen knuckle spacing
    liftCm?: number;   // seat depth along the palm normal
    tiltDamp?: number; // 1 = follow finger depth-tilt, 0 = frontal
    gemFlip?: boolean; // model's gem sits on -normal → flip it to the back
  };
  /** Bracelet placement on the wrist (see bracelets.ts BRACELET_FIT).
      Display props baked into the GLB are stripped via necklaceStrip. */
  braceletFit?: {
    loose?: number;    // hole = measured wrist width × this
    offsetCm?: number; // below the wrist crease, toward the forearm
    wristCm?: number;  // fallback wrist width (no world landmarks)
  };
  necklaceAnchor?: {
    /** Skull-fixed rotation pivot (top of the spine), head-local cm */
    pivotOffset?: { x?: number; y?: number; z?: number };
    /** Pivot → chain centre, straight down in the body frame (cm) */
    dropCm?: number;
    /** Spine axis → chest skin, toward the camera (cm) */
    forwardCm?: number;
    /** Loop width — should match the neck (cm) */
    widthCm?: number;
    /** Vertical size: loop + pendant drop (cm). Omit = same as width */
    lengthCm?: number;
    /** 'pendant' style only: the GLB pendant's true size (cm), never stretched */
    pendantCm?: number;
    /** Occluder ellipse (matches the MODEL's wrap opening): half-width,
        half-depth, height in cm */
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
  /** Contact-shadow size relative to earring scale (studs larger, danglers smaller). Default 0.35. */
  contactShadow?: number;
  /** Physics type: 'dangle' = hook/drop split + spring-damper swing;
      'hoop'/'stud' = rigid, full yaw-follow, no physics. Default 'dangle'. */
  arType?: 'dangle' | 'hoop' | 'stud';
  /** For 'dangle' only: GLB node names that stay rigid to the ear (the hook/
      clasp). Everything else swings. Omit to fall back to whole-model pivotDrop. */
  fixedNodes?: string[];
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
    
    arType: 'hoop',       // rigid loop, full yaw-follow, no swing physics
    arFit: { rotationDeg: [0, 0, 0], scale: 1.2 },
    skinPenetration: 0.5,
    // Zeroed — old values were tuned against the removed lobe estimator.
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
    image: "/images/earrings1.png",
    preserveMaterials: true,
    arType: 'stud',       // flat, rigid to the lobe, no physics at all
    skinPenetration: 1.5, // post fully hidden, gem sits flush on the lobe
    contactShadow: 0.5,   // stud presses flat → wider contact shadow
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
    image: "/images/earrings1.png",
    // Same process as Astraea; borrows its lobe calibration for now.
    pair: true,
    preserveMaterials: true,
    arType: 'dangle',
    dangle: { pivotDrop: 0.3 },
    skinPenetration: 0.5,
    arFit: { rotationDeg: [0, 0, 0] },
    // Zeroed — old values were tuned against the removed lobe estimator.
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
    image: "/images/earrings1.png",
    pair: true,
    preserveMaterials: true,
    arType: 'dangle',
    dangle: { pivotDrop: 0.3 },
    skinPenetration: 0.5,
    arFit: { rotationDeg: [0, 0, 0], scale: 1.6 },
    // Zeroed — old values were tuned against the removed lobe estimator.
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
    image: "/images/necklace1.png",
 
    necklaceStrip: ['badan', 'shirley'],
    metalOptions: true,
    necklaceAnchor: {
      pivotOffset: { x: -0.3, z: -4.9 }, dropCm: 4.7,
      widthCm: 17, lengthCm: 17.3, forwardCm: 0,
      occRxCm: 6.2, occRzCm: 4.4,
    },
  },
  {
    id: "necklace_locket",
    name: "Luna Locket",
    category: "necklaces",
    price: "Rs 1,150",
    description: "A polished gold locket on a fine chain — a hidden place for whatever you carry with you.",
    modelPath: "/models/necklaces/luna_locket.glb",
    arEnabled: true,
    image: "/images/necklace1.png",
    // The GLB contains its OWN fine chain + locket (authored at tiny scale).
    //  2026-07-15.
    metalOptions: true,
    necklaceAnchor: {
      pivotOffset: { x: -0.1, z: -5.2 }, dropCm: 4.8,
      widthCm: 15.3, forwardCm: 5.2,
      occRxCm: 9.5, occRzCm: 4.4,
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
    image: "/images/necklace1.png",
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
    arEnabled: true, // hand-tracked try-on (ring finger)
    image: "/images/ring1.png",
    preserveMaterials: true,
    arFit: { rotationDeg: [0, 0, 90] },
    // Calibrated on camera 2026-07-16 (size = × on-screen knuckle spacing).
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
    image: "/images/ring1.png",
    preserveMaterials: true,
    arFit: { rotationDeg: [-136, 0, 0] },
    // Calibrated 2026-07-16; gemFlip → pavé shows on the back of the hand.
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
    image: "/images/ring1.png",
    preserveMaterials: true,
    // Hole axis auto-detected on load; size/gem side calibrate live later.
    ringFit: { alongT: 0.5, sizeCm: 1.2 },
  },
  {
    id: "bracelet_lyra",
    name: "Lyra Topaz Weave",
    category: "bracelets",
    price: "Rs 1,350",
    description: "Woven gold strands set with blue topaz, clasped in hand-polished gold.",
    modelPath: "/models/bracelets/lyra_topaz_weave.glb",
    arEnabled: true,
    image: "/images/bracelet1.png",
    preserveMaterials: true,
    necklaceStrip: ['cube', 'velvet'],
    braceletFit: { loose: 1.15 },
  },
  {
    id: "bracelet_aurelia",
    name: "Aurelia Bangle",
    category: "bracelets",
    price: "Rs 1,100",
    description: "A sculpted gold bangle, worn a touch loose on the wrist.",
    modelPath: "/models/bracelets/bracelet (1).glb",
    arEnabled: true,
    image: "/images/bracelet1.png",
    preserveMaterials: true,
    braceletFit: { loose: 1.15 },
  }
];
