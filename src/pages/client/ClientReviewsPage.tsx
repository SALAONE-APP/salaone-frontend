import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Loader2, MessageSquareText, Scissors, Star } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  listAppointments,
  type Appointment,
} from "@/service/appointmentService";
import {
  createReview,
  listReviews,
  type CustomerReview,
} from "@/service/reviewService";

function getApiMessage(error: unknown) {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(data)) return data.join(" ");
  if (data && typeof data === "object") {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return "Nao foi possivel concluir a operacao.";
}

function getInitials(name?: string | null) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "-", time: "-" };
  return {
    date: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
  };
}

function renderStars(rating: number, size = 15) {
  return Array.from({ length: 5 }, (_, index) => (
    <Star
      key={index}
      size={size}
      className={index < rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}
    />
  ));
}

export function ClientReviewsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewAppointment, setReviewAppointment] = useState<Appointment | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [saving, setSaving] = useState(false);

  const reviewsByAppointment = useMemo(() => {
    return new Map(
      reviews
        .filter((review) => review.appointmentId)
        .map((review) => [review.appointmentId as string, review]),
    );
  }, [reviews]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      const [appointmentsResult, reviewsResult] = await Promise.all([
        listAppointments({
          clientId: user.id,
          status: "completed",
          page: 1,
          limit: 100,
        }),
        listReviews({ limit: 300 }),
      ]);

      setAppointments(
        appointmentsResult.items.sort(
          (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
        ),
      );
      setReviews(reviewsResult.items);
    } catch (err) {
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openReviewDialog(appointment: Appointment) {
    const existingReview = reviewsByAppointment.get(appointment.id);
    setReviewAppointment(appointment);
    setReviewRating(existingReview?.rating ?? 5);
    setReviewComment(existingReview?.comment ?? "");
  }

  async function handleSubmitReview() {
    if (!reviewAppointment) return;
    setSaving(true);

    try {
      await createReview({
        appointmentId: reviewAppointment.id,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      });
      toast.success("Avaliacao registrada.");
      setReviewAppointment(null);
      setReviewRating(5);
      setReviewComment("");
      await loadData();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Atendimentos finalizados</p>
          <h3 className="text-2xl font-semibold text-foreground">{appointments.length}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Avaliacoes enviadas</p>
          <h3 className="text-2xl font-semibold text-foreground">{reviews.length}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Pendentes</p>
          <h3 className="text-2xl font-semibold text-foreground">
            {appointments.filter((appointment) => !reviewsByAppointment.has(appointment.id)).length}
          </h3>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h3 className="text-base font-medium text-foreground">Meus atendimentos para avaliar</h3>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Carregando atendimentos...
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : appointments.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <MessageSquareText className="mx-auto mb-2 h-5 w-5" />
            Nenhum atendimento finalizado para avaliar.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {appointments.map((appointment) => {
              const review = reviewsByAppointment.get(appointment.id);
              const start = formatDateTime(appointment.startAt);
              const serviceText = appointment.services.map((service) => service.serviceName).join(", ") || "Sem servico";
              const barberName = appointment.barber?.displayName || "Sem barbeiro";

              return (
                <div key={appointment.id} className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="min-w-0 space-y-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {getInitials(barberName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{barberName}</p>
                        <p className="truncate text-xs text-muted-foreground">{serviceText}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={13} />
                        {start.date}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={13} />
                        {start.time}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Scissors size={13} />
                        {appointment.services.length} servico(s)
                      </span>
                    </div>

                    {review ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                          Avaliado
                        </Badge>
                        <div className="flex">{renderStars(review.rating)}</div>
                        {review.comment ? (
                          <span className="max-w-xl truncate text-xs text-muted-foreground">
                            {review.comment}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <Badge variant="outline" className="w-fit border-amber-500/20 bg-amber-500/10 text-amber-600">
                        Pendente
                      </Badge>
                    )}
                  </div>

                  <Button size="sm" onClick={() => openReviewDialog(appointment)}>
                    <Star size={14} />
                    {review ? "Editar avaliacao" : "Avaliar"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!reviewAppointment} onOpenChange={(open) => { if (!open && !saving) setReviewAppointment(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Avaliar atendimento</DialogTitle>
            <DialogDescription>
              Sua avaliacao sera enviada para a barbearia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nota</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setReviewRating(rating)}
                    className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-amber-500"
                    aria-label={`Nota ${rating}`}
                  >
                    <Star
                      size={26}
                      className={rating <= reviewRating ? "fill-amber-500 text-amber-500" : ""}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-review-comment">Comentario</Label>
              <Textarea
                id="client-review-comment"
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="Conte como foi sua experiencia."
                maxLength={1000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReviewAppointment(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmitReview} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enviar avaliacao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
