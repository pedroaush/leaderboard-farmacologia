import { useState, useRef } from "react";
import { Upload, X, File } from "lucide-react";

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes?: string[];
  maxSize?: number; // em bytes
  multiple?: boolean;
}

/**
 * Componente de zona de drag-and-drop para upload de arquivos
 * Suporta arrastar arquivos ou clicar para selecionar
 */
export function FileDropZone({
  onFilesSelected,
  acceptedTypes = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png", ".mp4"],
  maxSize = 50 * 1024 * 1024, // 50MB por padrão
  multiple = true,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: FileList | null): File[] => {
    if (!files) return [];

    const validFiles: File[] = [];
    const newErrors: string[] = [];

    Array.from(files).forEach((file) => {
      // Verificar tipo de arquivo
      const fileExt = "." + file.name.split(".").pop()?.toLowerCase();
      if (!acceptedTypes.includes(fileExt)) {
        newErrors.push(`${file.name} não é um tipo de arquivo permitido`);
        return;
      }

      // Verificar tamanho
      if (file.size > maxSize) {
        newErrors.push(`${file.name} excede o tamanho máximo de ${(maxSize / 1024 / 1024).toFixed(0)}MB`);
        return;
      }

      validFiles.push(file);
    });

    setErrors(newErrors);
    return validFiles;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = validateFiles(e.dataTransfer.files);
    if (files.length > 0) {
      const newFiles = multiple ? [...selectedFiles, ...files] : files;
      setSelectedFiles(newFiles);
      onFilesSelected(newFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = validateFiles(e.target.files);
    if (files.length > 0) {
      const newFiles = multiple ? [...selectedFiles, ...files] : files;
      setSelectedFiles(newFiles);
      onFilesSelected(newFiles);
    }
    // Reseta o valor do input — sem isso, selecionar o MESMO arquivo de novo
    // (ex.: depois de remover e tentar de novo) não dispara onChange, porque
    // o navegador só considera "mudança" quando o value é diferente do
    // anterior. Isso fazia parecer que o clique "não fazia nada".
    e.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer ${
          isDragging
            ? "border-primary bg-primary/10 scale-105"
            : "border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
          accept={acceptedTypes.join(",")}
        />

        <div className="flex flex-col items-center justify-center gap-2">
          <div
            className={`p-3 rounded-lg transition-colors ${
              isDragging ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
            }`}
          >
            <Upload size={24} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {isDragging ? "Solte os arquivos aqui" : "Arraste arquivos aqui ou clique para selecionar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tipos permitidos: {acceptedTypes.join(", ")} • Máximo: {(maxSize / 1024 / 1024).toFixed(0)}MB
            </p>
          </div>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((error, idx) => (
            <p key={idx} className="text-xs text-destructive flex items-center gap-1">
              <span>⚠️</span> {error}
            </p>
          ))}
        </div>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">
            {selectedFiles.length} arquivo{selectedFiles.length !== 1 ? "s" : ""} selecionado{selectedFiles.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/50 border border-border"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <File size={16} className="text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)}MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveFile(idx); }}
                  className="p-1 rounded hover:bg-destructive/20 text-destructive shrink-0"
                  title="Remover arquivo"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}