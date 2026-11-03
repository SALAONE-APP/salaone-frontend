import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  FileAudio,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  SALES_CHANNELS,
  createSalesScript,
  deleteSalesScript,
  deleteSalesScriptAttachment,
  listSalesScripts,
  SALES_PRODUCT_LABELS,
  salesChannelLabel,
  updateSalesScript,
  uploadSalesScriptAttachment,
  type SalesScript,
  type SalesScriptAttachment,
  type SalesScriptTopic,
} from "@/service/salesCrmService";
import { useSalesProduct } from "@/hooks/useSalesProduct";

function extractErrorMessage(error: unknown, fallback: string) {
  const value = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof value === "string" ? value : fallback;
}

function attachmentIcon(type: SalesScriptAttachment["type"]) {
  if (type === "image") return ImageIcon;
  if (type === "video") return Video;
  if (type === "audio") return FileAudio;
  return FileText;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Busca sem acento e sem diferenca de maiusculas ("preco" acha "Preço").
function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function topicCountLabel(count: number) {
  return `${count} tema${count === 1 ? "" : "s"}`;
}

const ALL_TOPICS = "all";
const TOPIC_TITLE_MAX = 150;
const TOPIC_RESPONSE_MAX = 10000;

interface TopicDraft {
  key: string;
  title: string;
  response: string;
}

let topicKeySeq = 0;
function newTopicDraft(title = "", response = ""): TopicDraft {
  topicKeySeq += 1;
  return { key: `topic-${topicKeySeq}`, title, response };
}

interface FormState {
  id: string | null;
  name: string;
  version: string;
  channel: string;
  topics: TopicDraft[];
  active: boolean;
  attachments: SalesScriptAttachment[];
}

const EMPTY_FORM: FormState = { id: null, name: "", version: "", channel: "none", topics: [], active: true, attachments: [] };

export function SalesCrmScriptsPage() {
  const product = useSalesProduct();
  const [scripts, setScripts] = useState<SalesScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState(ALL_TOPICS);
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deletingScript, setDeletingScript] = useState<SalesScript | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSalesScripts({ product });
      setScripts(result);
    } catch {
      setError("Não foi possível carregar os scripts.");
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    void load();
  }, [load]);

  // Trocar de produto limpa os filtros.
  useEffect(() => {
    setSearch("");
    setTopicFilter(ALL_TOPICS);
    setOpenTopics(new Set());
  }, [product]);

  // Opcoes do filtro: temas de todos os scripts, sem repetir.
  const topicOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const script of scripts) {
      for (const topic of script.topics ?? []) {
        const key = normalizeText(topic.title);
        if (key && !options.has(key)) options.set(key, topic.title.trim());
      }
    }
    return [...options.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [scripts]);

  const query = normalizeText(search);
  const filtering = query !== "" || topicFilter !== ALL_TOPICS;

  const visibleScripts = useMemo(() => {
    return scripts
      .map((script) => {
        const topics = script.topics ?? [];
        const byTheme = topicFilter === ALL_TOPICS ? topics : topics.filter((topic) => normalizeText(topic.title) === topicFilter);
        if (!query) return { script, topics: byTheme };
        // Nome do script bate: mostra todos os temas dele.
        if (topicFilter === ALL_TOPICS && normalizeText(script.name).includes(query)) return { script, topics };
        const matched = byTheme.filter(
          (topic) => normalizeText(topic.title).includes(query) || normalizeText(topic.response).includes(query),
        );
        return { script, topics: matched };
      })
      .filter(({ topics }) => !filtering || topics.length > 0);
  }, [scripts, query, topicFilter, filtering]);

  function clearFilters() {
    setSearch("");
    setTopicFilter(ALL_TOPICS);
  }

  function toggleTopic(key: string) {
    setOpenTopics((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function copyResponse(topic: SalesScriptTopic) {
    try {
      await navigator.clipboard.writeText(topic.response);
      toast.success(`Resposta "${topic.title}" copiada.`);
    } catch {
      toast.error("Não foi possível copiar a resposta.");
    }
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, topics: [newTopicDraft()] });
    setFormOpen(true);
  }

  function openEdit(script: SalesScript) {
    const topics = (script.topics ?? []).map((topic) => newTopicDraft(topic.title, topic.response));
    // Script antigo (tudo num texto so): vira o primeiro tema, para reorganizar.
    if (topics.length === 0 && script.content.trim()) topics.push(newTopicDraft("Geral", script.content));
    setForm({
      id: script.id,
      name: script.name,
      version: script.version,
      channel: script.channel ?? "none",
      topics: topics.length > 0 ? topics : [newTopicDraft()],
      active: script.active,
      attachments: script.attachments ?? [],
    });
    setFormOpen(true);
  }

  function addTopic() {
    setForm((f) => ({ ...f, topics: [...f.topics, newTopicDraft()] }));
  }

  function updateTopic(key: string, patch: Partial<Pick<TopicDraft, "title" | "response">>) {
    setForm((f) => ({ ...f, topics: f.topics.map((topic) => (topic.key === key ? { ...topic, ...patch } : topic)) }));
  }

  function removeTopic(key: string) {
    setForm((f) => ({ ...f, topics: f.topics.filter((topic) => topic.key !== key) }));
  }

  function moveTopic(index: number, direction: -1 | 1) {
    setForm((f) => {
      const target = index + direction;
      if (target < 0 || target >= f.topics.length) return f;
      const topics = [...f.topics];
      [topics[index], topics[target]] = [topics[target], topics[index]];
      return { ...f, topics };
    });
  }

  async function handleAttachmentSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !form.id) return;

    setUploadingAttachment(true);
    try {
      const attachment = await uploadSalesScriptAttachment(form.id, file);
      setForm((f) => ({ ...f, attachments: [...f.attachments, attachment] }));
      toast.success("Arquivo anexado.");
      void load();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível anexar o arquivo."));
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function handleRemoveAttachment(attachment: SalesScriptAttachment) {
    if (!form.id) return;
    setDeletingAttachmentId(attachment.id);
    try {
      await deleteSalesScriptAttachment(form.id, attachment.id);
      setForm((f) => ({ ...f, attachments: f.attachments.filter((a) => a.id !== attachment.id) }));
      toast.success("Anexo removido.");
      void load();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível remover o anexo."));
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do script.");
      return;
    }
    if (!form.version.trim()) {
      toast.error("Informe a versão do script.");
      return;
    }

    // Temas totalmente vazios sao ignorados; pela metade, avisa.
    const topics = form.topics
      .map((topic) => ({ title: topic.title.trim(), response: topic.response.trim() }))
      .filter((topic) => topic.title || topic.response);
    if (topics.length === 0) {
      toast.error("Adicione pelo menos um tema com a resposta.");
      return;
    }
    const incomplete = topics.findIndex((topic) => !topic.title || !topic.response);
    if (incomplete !== -1) {
      const topic = topics[incomplete];
      toast.error(topic.title ? `Informe a resposta do tema "${topic.title}".` : `Informe o título do tema ${incomplete + 1}.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        product,
        name: form.name.trim(),
        version: form.version.trim(),
        channel: form.channel === "none" ? null : form.channel,
        // O texto antigo passa a viver nos temas.
        content: "",
        topics,
        active: form.active,
      };
      if (form.id) {
        await updateSalesScript(form.id, payload);
        toast.success("Script atualizado.");
      } else {
        await createSalesScript(payload);
        toast.success("Script criado.");
      }
      setFormOpen(false);
      void load();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível salvar o script."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(script: SalesScript) {
    try {
      await updateSalesScript(script.id, { active: !script.active });
      void load();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível atualizar o script."));
    }
  }

  async function handleDelete() {
    if (!deletingScript) return;
    try {
      await deleteSalesScript(deletingScript.id);
      toast.success("Script excluído.");
      setDeletingScript(null);
      void load();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível excluir o script."));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">Scripts de Abordagem · {SALES_PRODUCT_LABELS[product]}</h1>
          <p className="text-sm text-muted-foreground">Respostas organizadas por tema, prontas para usar na prospecção.</p>
        </div>
        <Button size="sm" className="gap-2 self-start" onClick={openCreate}>
          <Plus size={14} />
          Novo script
        </Button>
      </div>

      {!loading && !error && scripts.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no título ou na resposta..."
            />
          </div>
          <Select value={topicFilter} onValueChange={setTopicFilter}>
            <SelectTrigger className="sm:w-64">
              <SelectValue placeholder="Filtrar por tema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TOPICS}>Todos os temas</SelectItem>
              {topicOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtering && (
            <Button variant="ghost" size="sm" className="gap-1.5 self-start sm:self-auto" onClick={clearFilters}>
              <X size={14} />
              Limpar
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>
      ) : scripts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center text-sm text-muted-foreground">
          Nenhum script cadastrado ainda.
        </div>
      ) : visibleScripts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Nenhum tema encontrado para este filtro.
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {visibleScripts.map(({ script, topics }) => (
            <div key={script.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{script.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Versão {script.version}
                    {(script.topics ?? []).length > 0 && ` · ${topicCountLabel(script.topics.length)}`}
                  </p>
                </div>
                <Badge variant={script.active ? "default" : "outline"} className="shrink-0 text-[11px]">
                  {script.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              {script.channel && (
                <Badge variant="outline" className="w-fit text-[11px]">
                  {salesChannelLabel(script.channel)}
                </Badge>
              )}

              {topics.length > 0 ? (
                <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {topics.map((topic, index) => {
                    const key = `${script.id}:${topic.id ?? index}`;
                    const open = filtering || openTopics.has(key);
                    return (
                      <div key={key}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary/40"
                          onClick={() => toggleTopic(key)}
                          aria-expanded={open}
                        >
                          <span className="min-w-0 truncate">{topic.title}</span>
                          <ChevronDown size={14} className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                        </button>
                        {open && (
                          <div className="flex flex-col gap-2 px-3 pb-3">
                            <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{topic.response}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-fit gap-1.5 text-xs"
                              onClick={() => void copyResponse(topic)}
                            >
                              <Copy size={12} />
                              Copiar resposta
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                script.content && <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{script.content}</p>
              )}

              {script.attachments?.length > 0 && (
                <span className="flex w-fit items-center gap-1 text-[11px] text-muted-foreground">
                  <Paperclip size={11} />
                  {script.attachments.length} anexo{script.attachments.length > 1 ? "s" : ""}
                </span>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Switch checked={script.active} onCheckedChange={() => void handleToggleActive(script)} />
                  <span className="text-xs text-muted-foreground">{script.active ? "Ativo" : "Inativo"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(script)} title="Editar">
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingScript(script)}
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar script" : "Novo script"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label>Nome</Label>
              <Input className="mt-1.5" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Versão</Label>
              <Input
                className="mt-1.5"
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                placeholder="Ex.: v1"
              />
            </div>
          </div>

          <div>
            <Label>Canal</Label>
            <Select value={form.channel} onValueChange={(value) => setForm((f) => ({ ...f, channel: value }))}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione o canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {SALES_CHANNELS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {salesChannelLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label>Temas</Label>
              <span className="text-[11px] text-muted-foreground">{topicCountLabel(form.topics.length)}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Um título por assunto (ex.: Apresentação, Preço, Teste grátis, Objeção "está caro") e a resposta para o lead.
            </p>
            <div className="mt-2 flex flex-col gap-3">
              {form.topics.map((topic, index) => (
                <div key={topic.key} className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/20 p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground">{index + 1}.</span>
                    <Input
                      className="h-8"
                      value={topic.title}
                      onChange={(e) => updateTopic(topic.key, { title: e.target.value })}
                      placeholder="Título do tema"
                      maxLength={TOPIC_TITLE_MAX}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => moveTopic(index, -1)}
                      disabled={index === 0}
                      title="Subir"
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => moveTopic(index, 1)}
                      disabled={index === form.topics.length - 1}
                      title="Descer"
                    >
                      <ArrowDown size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                      onClick={() => removeTopic(topic.key)}
                      title="Remover tema"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <Textarea
                    className="min-h-24"
                    value={topic.response}
                    onChange={(e) => updateTopic(topic.key, { response: e.target.value })}
                    placeholder="Resposta para o lead..."
                    maxLength={TOPIC_RESPONSE_MAX}
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-fit gap-2" onClick={addTopic}>
                <Plus size={14} />
                Adicionar tema
              </Button>
            </div>
          </div>

          <div>
            <Label>Anexos</Label>
            {!form.id ? (
              <p className="mt-1.5 text-xs text-muted-foreground">Salve o script para poder anexar arquivos.</p>
            ) : (
              <div className="mt-1.5 space-y-2">
                {form.attachments.map((attachment) => {
                  const Icon = attachmentIcon(attachment.type);
                  return (
                    <div key={attachment.id} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                      <Icon size={16} className="shrink-0 text-muted-foreground" />
                      <a
                        href={attachment.downloadUrl ?? attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-xs text-foreground hover:underline"
                        title={attachment.name}
                      >
                        {attachment.name}
                      </a>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatBytes(attachment.bytes)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => void handleRemoveAttachment(attachment)}
                        disabled={deletingAttachmentId === attachment.id}
                        title="Remover anexo"
                      >
                        {deletingAttachmentId === attachment.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                      </Button>
                    </div>
                  );
                })}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,application/pdf"
                  className="hidden"
                  onChange={(e) => void handleAttachmentSelected(e)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploadingAttachment}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingAttachment ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                  {uploadingAttachment ? "Enviando..." : "Anexar arquivo"}
                </Button>
                <p className="text-[11px] text-muted-foreground">Imagem, vídeo, áudio ou PDF. Até 25MB.</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={(checked) => setForm((f) => ({ ...f, active: checked }))} />
            <Label>Script ativo</Label>
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-fit self-end">
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingScript)} onOpenChange={(open) => !open && setDeletingScript(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir script?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente o script "{deletingScript?.name}" ({deletingScript?.version}). Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
