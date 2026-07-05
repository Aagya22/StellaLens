export interface Product {
  id: string;
  name: string;
  category: 'earrings' | 'necklaces';
  price: string;
  description: string;
  modelPath: string;
  arEnabled: boolean;
  image: string;
  customizeColors?: boolean;
}

export const PRODUCTS: Product[] = [
  {
    id: "earring_diamond",
    name: "Astraea Diamond Drops",
    category: "earrings",
    price: "$1,250",
    description: "Exquisite drop earrings handcrafted in 24k gold, showcasing a brilliant-cut Ruby stud and a stunning Tanzanite teardrop, surrounded by a pavé halo of diamonds.",
    modelPath: "/models/earrings/diamond_earrings.glb",
    arEnabled: true,
    image: "/images/earrings1.png",
    customizeColors: true
  },
  {
    id: "earring_gold_hoop",
    name: "Lunette Golden Hoops",
    category: "earrings",
    price: "$650",
    description: "Classic huggie hoop earrings forged from solid 18k yellow gold, featuring a high-polish mirror finish and a lightweight, comfort-fit design.",
    modelPath: "/models/earrings/earring_gold_hoopp.glb",
    arEnabled: true,
    image: "/images/earrings2.png"
  },
  {
    id: "necklace_gold",
    name: "Orlaith Celestial Chain",
    category: "necklaces",
    price: "$1,800",
    description: "A premium solid gold statement collar, featuring dynamic articulation that rests perfectly on the neck. Masterfully hand-carved in 22k yellow gold.",
    modelPath: "/models/necklaces/necklace_gold.glb",
    arEnabled: true,
    image: "/images/necklace1.png"
  }
];
