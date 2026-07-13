import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquareText, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { listReviews, type CustomerReview } from "@/service/reviewService";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <Star
      key={index}
      size={15}
      className={index < rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}
    />
  ));
}

export function ReviewsPage() {
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReviews = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const result = await listReviews({ limit: 300 });
      setReviews(result.items);
    } catch {
      setReviews([]);
      setError("Nao foi possivel carregar as avaliacoes.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    loadReviews().finally(() => {
      if (!mounted) return;
    });

    const timer = window.setInterval(() => {
      void loadReviews(true);
    }, 10000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [loadReviews]);

  const stats = useMemo(() => {
    const total = reviews.length;
    const average = total
      ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / total
      : 0;
    const now = new Date();
    const thisMonth = reviews.filter((item) => {
      const date = new Date(item.createdAt);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;

    return {
      total,
      average,
      thisMonth,
    };
  }, [reviews]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Avaliacoes recebidas</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.total}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Media geral</p>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-semibold text-foreground">
              {stats.average ? stats.average.toFixed(1) : "0.0"}
            </h3>
            <div className="flex">{renderStars(Math.round(stats.average))}</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Este mes</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.thisMonth}</h3>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-base font-medium text-foreground">Avaliacoes dos clientes</h3>
          <Badge variant="outline">Atualiza a cada 10s</Badge>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Carregando avaliacoes...
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : reviews.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <MessageSquareText className="mx-auto mb-2 h-5 w-5" />
            Nenhuma avaliacao registrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Data", "Nota", "Cliente", "Profissional", "Servico", "Comentario"].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr
                    key={review.id}
                    className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3 text-sm text-foreground">{formatDate(review.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">{renderStars(review.rating)}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{review.clientName || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{review.barberName || "-"}</td>
                    <td className="max-w-64 px-4 py-3 text-sm text-muted-foreground">
                      <span className="block truncate">{review.services?.join(", ") || "-"}</span>
                    </td>
                    <td className="max-w-80 px-4 py-3 text-sm text-muted-foreground">
                      <span className="block whitespace-pre-wrap">{review.comment || "-"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
