export type CatalogProduct = {
  id: string;
  code: string;
  name: string;
  description: string;
  priceNaira: number;
};

export const catalog: CatalogProduct[] = [
  {
    id: "desk-lamp-01",
    code: "ML01",
    name: "Orbit Desk Lamp",
    description: "Synthetic catalog item · Abuja demo inventory",
    priceNaira: 28500,
  },
  {
    id: "speaker-02",
    code: "ML02",
    name: "Mono Mini Speaker",
    description: "Synthetic catalog item · Lagos demo inventory",
    priceNaira: 41750,
  },
  {
    id: "bag-03",
    code: "ML03",
    name: "Transit Work Bag",
    description: "Synthetic catalog item · Port Harcourt demo inventory",
    priceNaira: 63500,
  },
];

export function findProduct(id: string) {
  return catalog.find((product) => product.id === id);
}
