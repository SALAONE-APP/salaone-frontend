import api from "./api";

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price: number;
  subscriberDiscount?: number;
  subscriber_discount?: number;
  imageUrl?: string | null;
  image_url?: string | null;
  imagePublicId?: string | null;
  image_public_id?: string | null;
  stock: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  salonId?: string;
}

export interface ListProductsParams {
  active?: boolean;
  category?: string;
  q?: string;
}

export interface ProductPayload {
  name: string;
  description?: string | null;
  category?: string | null;
  price: number;
  subscriberDiscount?: number;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  active?: boolean;
}

export type ProductStockMovementType = "entry" | "exit";

export interface ProductStockMovement {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  salonId: string;
  type: ProductStockMovementType;
  quantity: number;
  purchasePrice?: number | null;
  salePrice?: number | null;
  occurredAt: string;
  note?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
  stockAfter: number;
}

export interface ListProductStockMovementsParams {
  productId?: string;
  type?: ProductStockMovementType;
  q?: string;
  limit?: number;
}

export interface ProductStockMovementPayload {
  productId: string;
  type: ProductStockMovementType;
  quantity: number;
  purchasePrice?: number | null;
  salePrice?: number | null;
  occurredAt?: string;
  note?: string | null;
}

export async function listProducts(params: ListProductsParams = {}) {
  const response = await api.get<Product[]>("/products", { params });

  return response.data;
}

export async function createProduct(data: ProductPayload) {
  const response = await api.post<Product>("/products", data);

  return response.data;
}

export async function updateProduct(productId: string, data: Partial<ProductPayload>) {
  const response = await api.patch<Product>(`/products/${productId}`, data);

  return response.data;
}

export async function deleteProduct(productId: string) {
  const response = await api.delete<{
    ok: boolean;
    product: Product;
    deletedHard: boolean;
    reason: string;
  }>(`/products/${productId}`);

  return response.data;
}

export async function reactivateProduct(productId: string) {
  const response = await api.patch<{
    ok: boolean;
    product: Product;
    reason: string;
  }>(`/products/${productId}/reactivate`);

  return response.data;
}

export async function listProductStockMovements(
  params: ListProductStockMovementsParams = {},
) {
  const response = await api.get<ProductStockMovement[]>("/products/stock-movements", {
    params,
  });

  return response.data;
}

export async function createProductStockMovement(data: ProductStockMovementPayload) {
  const response = await api.post<{
    product: Product;
    movement: ProductStockMovement;
  }>("/products/stock-movements", data);

  return response.data;
}

export async function purchaseProduct(productId: string, quantity: number) {
  const response = await api.post<{
    orderId: string;
    paymentId: string;
    total: number;
    status: string;
    stock: number;
  }>("/products/purchase", { productId, quantity });
  return response.data;
}

export async function checkoutProductCart(
  items: Array<{ productId: string; quantity: number }>,
) {
  const response = await api.post<{
    orderId: string;
    paymentId: string;
    total: number;
    status: string;
    items: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
  }>("/products/cart/checkout", { items });
  return response.data;
}

export interface WalkInProductSalePayload {
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  method: "pix" | "debito" | "credito" | "dinheiro";
  paidAt?: string;
  note?: string | null;
}

export async function createWalkInProductSale(data: WalkInProductSalePayload) {
  const response = await api.post<{
    orderId: string;
    paymentId: string;
    total: number;
    status: string;
  }>("/products/walk-in-sale", data);
  return response.data;
}

export interface ProductOrder {
  orderId: string;
  status: string;
  total: number;
  createdAt: string;
  payment: {
    id: string;
    method: string;
    status: string;
    paidAt?: string | null;
  } | null;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export async function listProductOrders() {
  const response = await api.get<ProductOrder[]>("/products/orders");
  return response.data;
}

export interface SalonProductOrder extends ProductOrder {
  client: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
}

export async function listSalonProductOrders() {
  const response = await api.get<SalonProductOrder[]>("/products/orders/admin");
  return response.data;
}
