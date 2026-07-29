import type { Product } from "./productService";

const STORAGE_KEY = "salaone-product-cart";
export const CART_UPDATED_EVENT = "salaone-cart-updated";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  stock: number;
  quantity: number;
}

function save(items: CartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
  return items;
}

export function getCart(): CartItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addProductToCart(product: Product) {
  const items = getCart();
  const current = items.find((item) => item.productId === product.id);
  if (current) {
    current.stock = product.stock;
    current.price = product.price;
    current.quantity = Math.min(product.stock, current.quantity + 1);
  } else {
    items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl ?? product.image_url,
      stock: product.stock,
      quantity: 1,
    });
  }
  return save(items);
}

export function updateCartItemQuantity(productId: string, quantity: number) {
  return save(getCart()
    .map((item) => item.productId === productId
      ? { ...item, quantity: Math.min(item.stock, Math.max(0, quantity)) }
      : item)
    .filter((item) => item.quantity > 0));
}

export function removeCartItem(productId: string) {
  return save(getCart().filter((item) => item.productId !== productId));
}

export function clearCart() {
  return save([]);
}
