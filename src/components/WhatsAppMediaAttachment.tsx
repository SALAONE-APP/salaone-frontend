import { useEffect, useState } from "react";
import { FileText, ImageOff, Loader2, Video } from "lucide-react";
import { getMessageMedia, type WhatsAppMediaInfo } from "@/service/whatsappHubService";

// Exibe a mídia de uma mensagem do WhatsApp. O link é temporário (5 min) e pedido só quando necessário.
export function WhatsAppMediaAttachment({ messageId, media }: { messageId: string; media: WhatsAppMediaInfo }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const autoLoad = media.status === "STORED" && (media.kind === "image" || media.kind === "sticker" || media.kind === "audio");

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const r = await getMessageMedia(messageId);
      setUrl(r.url);
      if (!r.url) setError(true);
      return r.url;
    } catch {
      setError(true);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoLoad) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId, media.status]);

  if (media.kind === "video" || media.status === "SKIPPED") {
    return (
      <p className="flex items-center gap-1.5 text-xs opacity-80">
        <Video className="size-3.5" /> {media.reason ?? "Mídia não disponível"} — veja no celular.
      </p>
    );
  }
  if (media.status === "PENDING") {
    return (
      <p className="flex items-center gap-1.5 text-xs opacity-80">
        <Loader2 className="size-3.5 animate-spin" /> Carregando arquivo…
      </p>
    );
  }
  if (media.status === "FAILED" || media.status === "EXPIRED" || error) {
    return (
      <p className="flex items-center gap-1.5 text-xs opacity-80">
        <ImageOff className="size-3.5" /> {media.status === "EXPIRED" ? "Arquivo apagado após 30 dias" : "Não foi possível carregar o arquivo"}
      </p>
    );
  }

  if (media.kind === "image" || media.kind === "sticker") {
    return url ? (
      <a href={url} target="_blank" rel="noreferrer noopener">
        <img src={url} alt={media.fileName ?? "Imagem recebida"} className="max-h-64 rounded-md" loading="lazy" onError={() => setError(true)} />
      </a>
    ) : (
      <Loader2 className="size-4 animate-spin" />
    );
  }
  if (media.kind === "audio") {
    return url ? <audio controls src={url} className="max-w-full" /> : <Loader2 className="size-4 animate-spin" />;
  }
  // Documento: o link é gerado no clique (vale 5 minutos)
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 text-sm underline underline-offset-2"
      disabled={loading}
      onClick={async () => {
        const link = url ?? (await load());
        if (link) window.open(link, "_blank", "noopener,noreferrer");
      }}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
      {media.fileName ?? "Documento"}
    </button>
  );
}
