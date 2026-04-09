import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Link2, MessageSquare, Download, ExternalLink,
  FlaskConical, ArrowLeft, BookOpen, Search, Filter,
  Youtube, Play, X, ChevronDown, ChevronUp, Loader2
} from "lucide-react";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/oUYumbCRVNHBqtNw.png";

export default function Materiais() {
  const [selectedModule, setSelectedModule] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"materials" | "playlists">("materials");
  const [expandedPlaylist, setExpandedPlaylist] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Função para obter URL assinada e abrir o download
  const handleDownload = useCallback(async (mat: any) => {
    if (!mat.fileKey) {
      window.open(mat.url, '_blank');
      return;
    }
    setDownloadingId(mat.id);
    try {
      const response = await fetch(
        `/api/trpc/materials.getDownloadUrl?input=${encodeURIComponent(JSON.stringify({ fileKey: mat.fileKey }))}`
      );
      const data = await response.json();
      const signedUrl = data?.result?.data?.url;
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      } else {
        window.open(mat.url, '_blank');
      }
    } catch (error) {
      console.error("Erro ao obter URL de download:", error);
      window.open(mat.url, '_blank');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const { data: materials, isLoading: materialsLoading } = trpc.materials.getVisible.useQuery();
  const { data: playlists, isLoading: playlistsLoading } = trpc.youtubePlaylists.getVisible.useQuery();

  // Get unique modules from both materials and playlists
  const modules = useMemo(() => {
    const mods = new Set<string>();
    if (materials) materials.forEach(m => mods.add(m.module || "Geral"));
    if (playlists) playlists.forEach(p => mods.add(p.module || "Geral"));
    return ["Todos", ...Array.from(mods).sort()];
  }, [materials, playlists]);

  // Filter materials
  const filteredMaterials = useMemo(() => {
    if (!materials) return [];
    return materials.filter(m => {
      const matchModule = selectedModule === "Todos" || m.module === selectedModule;
      const matchSearch = !searchQuery ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchModule && matchSearch;
    });
  }, [materials, selectedModule, searchQuery]);

  // Filter playlists
  const filteredPlaylists = useMemo(() => {
    if (!playlists) return [];
    return playlists.filter(p => {
      const matchModule = selectedModule === "Todos" || p.module === selectedModule;
      const matchSearch = !searchQuery ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchModule && matchSearch;
    });
  }, [playlists, selectedModule, searchQuery]);

  // Group materials by module
  const groupedMaterials = useMemo(() => {
    const g: Record<string, typeof filteredMaterials> = {};
    for (const m of filteredMaterials) {
      const mod = m.module || "Geral";
      if (!g[mod]) g[mod] = [];
      g[mod].push(m);
    }
    return g;
  }, [filteredMaterials]);

  // Group playlists by module
  const groupedPlaylists = useMemo(() => {
    const g: Record<string, typeof filteredPlaylists> = {};
    for (const p of filteredPlaylists) {
      const mod = p.module || "Geral";
      if (!g[mod]) g[mod] = [];
      g[mod].push(p);
    }
    return g;
  }, [filteredPlaylists]);

  const typeIcons: Record<string, React.ReactNode> = {
    file: <FileText size={18} className="text-blue-400" />,
    link: <Link2 size={18} className="text-primary" />,
    comment: <MessageSquare size={18} className="text-green-400" />,
  };

  const typeLabels: Record<string, string> = {
    file: "Arquivo",
    link: "Link",
    comment: "Comentário",
  };

  const getEmbedUrl = (p: any) => {
    if (p.videoType === "playlist") {
      return `https://www.youtube.com/embed/videoseries?list=${p.youtubeId}`;
    }
    return `https://www.youtube.com/embed/${p.youtubeId}`;
  };

  const isLoading = activeTab === "materials" ? materialsLoading : playlistsLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <div className="container py-4 flex items-center gap-3">
          <a href="/leaderboard" className="text-muted-foreground hover:text-primary">
            <ArrowLeft size={18} />
          </a>
          <img src={LOGO_URL} alt="Logo" className="w-10 h-10 object-contain" />
          <div className="flex-1">
            <h1 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <BookOpen size={20} className="text-primary" /> Materiais de Estudo
            </h1>
            <p className="text-xs text-muted-foreground">Conexão em Farmacologia — UNIRIO</p>
          </div>
          <a href="/" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
            <FlaskConical size={12} /> Início
          </a>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="container pt-4">
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 w-fit mb-4">
          <button
            onClick={() => setActiveTab("materials")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "materials"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen size={15} /> Materiais
            {materials && <span className="text-xs opacity-70">({materials.length})</span>}
          </button>
          <button
            onClick={() => setActiveTab("playlists")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "playlists"
                ? "bg-red-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Youtube size={15} /> Playlists
            {playlists && <span className="text-xs opacity-70">({playlists.length})</span>}
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="container pb-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder={activeTab === "materials" ? "Buscar materiais..." : "Buscar playlists..."}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <select
              value={selectedModule}
              onChange={e => setSelectedModule(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm"
            >
              {modules.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container pb-16">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">
            {activeTab === "materials" ? (
              <BookOpen size={32} className="mx-auto mb-3 opacity-50" />
            ) : (
              <Youtube size={32} className="mx-auto mb-3 opacity-50" />
            )}
            <p className="text-sm">Carregando...</p>
          </div>
        ) : activeTab === "materials" ? (
          /* ─── Materials Tab ─── */
          filteredMaterials.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <BookOpen size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">Nenhum material disponível</p>
              <p className="text-xs mt-1">Os materiais serão publicados pelo professor ao longo do semestre.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedMaterials).map(([mod, items]) => (
                <motion.div
                  key={mod}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="font-display font-bold text-sm text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {mod}
                    <span className="text-muted-foreground font-normal text-xs">({items.length})</span>
                  </h2>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((mat, idx) => (
                      <motion.div
                        key={mat.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        className="border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
                        style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: "oklch(0.245 0.03 264.052)" }}
                          >
                            {typeIcons[mat.type]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium">
                                {typeLabels[mat.type]}
                              </span>
                              {mat.week && (
                                <span className="text-[10px] text-muted-foreground">Sem. {mat.week}</span>
                              )}
                            </div>
                            <h3 className="font-medium text-sm text-foreground leading-snug">{mat.title}</h3>
                            {mat.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mat.description}</p>
                            )}

                            {/* Action buttons */}
                            <div className="mt-3 flex items-center gap-2">
                              {mat.type === "file" && mat.url && (
                                <button
                                  onClick={() => handleDownload(mat)}
                                  disabled={downloadingId === mat.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                                  style={{ backgroundColor: "rgba(247,148,29,0.15)", color: "#F7941D" }}
                                >
                                  {downloadingId === mat.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Download size={12} />
                                  )}
                                  {downloadingId === mat.id ? "Carregando..." : "Baixar"}
                                </button>
                              )}
                              {mat.type === "link" && mat.url && (
                                <a
                                  href={mat.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                                  style={{ backgroundColor: "rgba(247,148,29,0.15)", color: "#F7941D" }}
                                >
                                  <ExternalLink size={12} /> Abrir Link
                                </a>
                              )}
                            </div>

                            {mat.type === "file" && mat.fileName && (
                              <p className="text-[10px] text-muted-foreground mt-2 truncate">
                                📎 {mat.fileName}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {new Date(mat.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          /* ─── Playlists Tab ─── */
          filteredPlaylists.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Youtube size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">Nenhuma playlist disponível</p>
              <p className="text-xs mt-1">As playlists serão adicionadas pelo professor ao longo do semestre.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedPlaylists).map(([mod, items]) => (
                <motion.div
                  key={mod}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="font-display font-bold text-sm text-red-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Youtube size={14} />
                    {mod}
                    <span className="text-muted-foreground font-normal text-xs">({items.length})</span>
                  </h2>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((pl: any, idx: number) => (
                      <motion.div
                        key={pl.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        className="border border-border rounded-lg overflow-hidden hover:border-red-500/30 transition-colors group"
                        style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
                      >
                        {/* Thumbnail / Embed */}
                        {expandedPlaylist === pl.id ? (
                          <div className="relative">
                            <div className="aspect-video">
                              <iframe
                                src={getEmbedUrl(pl)}
                                title={pl.title}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                            <button
                              onClick={() => setExpandedPlaylist(null)}
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors z-10"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setExpandedPlaylist(pl.id)}
                            className="relative w-full aspect-video bg-black/50 flex items-center justify-center cursor-pointer overflow-hidden"
                          >
                            {pl.thumbnailUrl ? (
                              <img
                                src={pl.thumbnailUrl}
                                alt={pl.title}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900/30 to-black/50">
                                <Youtube size={48} className="text-red-500 opacity-50" />
                              </div>
                            )}
                            {/* Play overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-14 h-14 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg group-hover:bg-red-600 group-hover:scale-110 transition-all">
                                <Play size={24} className="text-white ml-1" fill="white" />
                              </div>
                            </div>
                            {/* Type badge */}
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/70 text-white">
                              {pl.videoType === "playlist" ? "PLAYLIST" : "VÍDEO"}
                            </div>
                          </button>
                        )}

                        {/* Info */}
                        <div className="p-3">
                          <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2">{pl.title}</h3>
                          {pl.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{pl.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {pl.week && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium">
                                Sem. {pl.week}
                              </span>
                            )}
                            <a
                              href={pl.videoType === "playlist"
                                ? `https://www.youtube.com/playlist?list=${pl.youtubeId}`
                                : `https://www.youtube.com/watch?v=${pl.youtubeId}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
                            >
                              <ExternalLink size={10} /> Abrir no YouTube
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
