import api from "./api";
export type PriceScope = "platform" | "client";
export type PriceTarget = { planId: string; price: number; subscriptionId?: string; saveCatalog?: () => Promise<void> };
export type PriceChangeItem = {
  id: string; label: string; remote_id: string | null; status: string; message: string | null;
  snapshot: { oldCents: number; quantity: number; nextBillingAt: string | null } | null;
};
export type PriceChange = {
  id: string; target_cents: number; catalog_cents: number; confirmed_at: string | null;
  created_at: string; next_cursor: string | null; items: PriceChangeItem[]; timing: string;
};
function base(scope: PriceScope) { return `/${scope}-subscription-price-changes`; }
export const subscriptionPriceChanges = {
  async list(scope: PriceScope, planId: string) { return (await api.get<PriceChange[]>(base(scope), { params: { planId } })).data; },
  async get(scope: PriceScope, id: string) { return (await api.get<PriceChange>(`${base(scope)}/${id}`)).data; },
  async create(scope: PriceScope, target: PriceTarget, after?: string) {
    return (await api.post<PriceChange>(base(scope), { planId: target.planId, price: target.price, subscriptionId: target.subscriptionId, after })).data;
  },
  async confirm(scope: PriceScope, id: string) { return (await api.post<PriceChange>(`${base(scope)}/${id}/confirm`, { confirmed: true })).data; },
  async step(scope: PriceScope, id: string, action: "preview" | "apply" | "retry", itemId?: string) {
    return (await api.post<PriceChange>(`${base(scope)}/${id}/step`, { action, itemId })).data;
  },
};
