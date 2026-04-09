import { useState, useMemo, useCallback } from "react";
import { Search, Filter, X, Download, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { MaterialTypeBadge } from "@/components/MaterialTypeBadge";

type SortOption = "recent" | "oldest" | "alphabetical";

export default function StudentMaterials() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [previewMaterial, setPreviewMaterial] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Buscar materiais visíveis
  const { data: materials = [], isLoading } = trpc.materials.getVisible.useQuery();

  // Extrair módulos e semanas
  const { allModules, weeks } = useMemo(() => {
    const moduleSet = new Set<string>();
    const weekSet = new Set<number>();

    materials.forEach(mat => {
      if (mat.module) moduleSet.add(mat.module);
      if (mat.week) weekSet.add(mat.week);
    });

    return {
      allModules: Array.from(moduleSet).sort(),
      weeks: Array.from(weekSet).sort((a, b) => a - b),
    };
  }, [materials]);

  // Filtrar e ordenar materiais
  const filteredMaterials = useMemo(() => {
    let result = materials.filter(mat => {
      // Filtro de busca
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        mat.title.toLowerCase().includes(searchLower) ||
        (mat.description?.toLowerCase().includes(searchLower) ?? false);

      // Filtro de módulo
      const matchesModule = !selectedModule || mat.module === selectedModule;

      // Filtro de semana
      const matchesWeek = !selectedWeek || mat.week === parseInt(selectedWeek);

      return matchesSearch && matchesModule && matchesWeek;
    });

    // Ordenar
    result.sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "alphabetical":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [materials, searchTerm, selectedModule, selectedWeek, sortBy]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedModule("");
    setSelectedWeek("");
    setSortBy("recent");
  };

  const hasActiveFilters = searchTerm || selectedModule || selectedWeek;

    // Função para baixar material via proxy do servidor
  const handleDownload = useCallback(async (material: any) => {
    // Se não tem fileKey, é um link externo - abrir diretamente
    if (!material.fileKey) {
      window.open(material.url, '_blank');
      return;
    }
    setDownloadingId(material.id);
    try {
      // Usar o endpoint proxy que baixa do Cloudinary via generate_archive API
      const downloadUrl = `/api/materials/download?fileKey=${encodeURIComponent(material.fileKey)}`;
      
      // Criar um link temporário para download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = material.fileName || material.fileKey.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Erro ao baixar material:", error);
      // Fallback: tentar URL direta
      window.open(material.url, '_blank');
    } finally {
      setTimeout(() => setDownloadingId(null), 2000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="container py-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Materiais da Disciplina</h1>
          <p className="text-muted-foreground">Acesse todos os materiais disponibilizados pelos professores</p>
        </div>
      </div>

      <div className="container py-6">
        {/* Busca e Filtros */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-muted-foreground" size={18} />
              <Input
                placeholder="Buscar materiais..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter size={18} />
              Filtros
              {hasActiveFilters && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {[selectedModule ? 1 : 0, selectedWeek ? 1 : 0].filter(Boolean).length}
                </span>
              )}
            </Button>
          </div>

          {/* Filtros Expandidos */}
          {showFilters && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              {/* Módulos */}
              {allModules.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Módulo</label>
                  <select
                    value={selectedModule}
                    onChange={(e) => setSelectedModule(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="">Todos os módulos</option>
                    {allModules.map(module => (
                      <option key={module} value={module}>{module}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Semanas */}
              {weeks.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Semana</label>
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="">Todas as semanas</option>
                    {weeks.map(week => (
                      <option key={week} value={week}>Semana {week}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ordenação */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Ordenar por</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="recent">Mais recentes</option>
                  <option value="oldest">Mais antigos</option>
                  <option value="alphabetical">Alfabético</option>
                </select>
              </div>

              {/* Limpar Filtros */}
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="w-full gap-2"
                >
                  <X size={16} />
                  Limpar filtros
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Resultados */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando materiais...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum material encontrado</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMaterials.map(material => (
              <div
                key={material.id}
                className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground line-clamp-2">{material.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{material.module}</p>
                  </div>
                  <MaterialTypeBadge type={material.type} />
                </div>

                {material.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{material.description}</p>
                )}

                {material.week && (
                  <Badge variant="outline" className="mb-3">
                    Semana {material.week}
                  </Badge>
                )}

                <div className="flex gap-2 pt-3 border-t border-border">
                  {material.url && material.fileKey && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => setPreviewMaterial(material)}
                    >
                      <Eye size={14} />
                      Visualizar
                    </Button>
                  )}
                  {material.url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-2"
                      disabled={downloadingId === material.id}
                      onClick={() => handleDownload(material)}
                    >
                      {downloadingId === material.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      {material.fileKey ? "Baixar" : "Abrir"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      {previewMaterial && (
        <Dialog open={!!previewMaterial} onOpenChange={() => setPreviewMaterial(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{previewMaterial.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {previewMaterial.description && (
                <p className="text-muted-foreground">{previewMaterial.description}</p>
              )}
              
              {previewMaterial.type === "link" && previewMaterial.url && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Link:</p>
                  <a
                    href={previewMaterial.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {previewMaterial.url}
                  </a>
                  <Button
                    onClick={() => window.open(previewMaterial.url, '_blank')}
                    className="w-full gap-2"
                  >
                    <Eye size={16} />
                    Abrir Link
                  </Button>
                </div>
              )}

              {previewMaterial.type === "file" && previewMaterial.url && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Arquivo: {previewMaterial.fileName}</p>
                  <Button
                    disabled={downloadingId === previewMaterial.id}
                    onClick={() => handleDownload(previewMaterial)}
                    className="w-full gap-2"
                  >
                    {downloadingId === previewMaterial.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    Baixar Arquivo
                  </Button>
                </div>
              )}

              {previewMaterial.type === "comment" && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-foreground">{previewMaterial.description}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
