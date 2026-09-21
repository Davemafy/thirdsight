export type CategorySlug = "phones" | "headphones" | "earbuds" | "smartwatches" | "speakers" | "keyboards" | "cameras" | "power";

export interface ProductImage { id: string; url: string; alt: string; sortOrder: number }
export interface ProductVariant {
  id: string;
  sku: string;
  finish: string;
  finishHex: string;
  configuration: string;
  price: number;
  compareAtPrice: number | null;
  inventory: number;
  imageUrls: string[];
}
export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  shortDescription: string;
  description: string;
  rating: number;
  reviewCount: number;
  specifications: Record<string, string>;
  deliveryEstimate: string;
  warranty: string;
  featured: boolean;
  newArrival: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
  relatedSlugs: string[];
}
export interface CartLine {
  id: string;
  cartId: string;
  variantId: string;
  quantity: number;
  product: Product;
  variant: ProductVariant;
}
export interface Cart {
  id: string;
  status: "ACTIVE" | "CONVERTED" | "ABANDONED";
  promoCode: string | null;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
}
export interface CheckoutState {
  id: string;
  cartId: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  deliveryMethod: "STANDARD" | "EXPRESS" | "PICKUP" | null;
  paymentMethod: "TEST_VISA_4242" | "PAY_ON_DELIVERY" | "SYNTHETIC_BANK_TRANSFER" | null;
}
export interface Order {
  id: string;
  orderNumber: string;
  status: "CONFIRMED" | "PROCESSING" | "DISPATCHED" | "DELIVERED";
  paymentStatus: "SYNTHETIC_AUTHORIZED" | "PENDING";
  email: string;
  phone: string;
  deliveryAddress: Record<string, string>;
  deliveryMethod: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  createdAt: string;
  estimatedDelivery: string;
  lines: Array<{ id: string; productName: string; variantLabel: string; sku: string; quantity: number; unitPrice: number; imageUrl: string }>;
  evidenceId?: string | null;
}
