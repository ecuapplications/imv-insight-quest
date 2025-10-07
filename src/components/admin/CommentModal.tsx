import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

type Encuesta = {
  id: string;
  comentario: string;
  estado_kanban: string;
  etiquetas: string[];
  fecha_creacion: string;
  pregunta1_amabilidad: string;
  pregunta2_tiempo_espera: string;
  pregunta3_resolucion_dudas: string;
  pregunta4_limpieza: string;
  pregunta5_calificacion_general: string;
  notas_internas: string | null;
};

type CommentModalProps = {
  encuesta: Encuesta;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  etiquetasDisponibles: string[];
};

const CommentModal = ({ encuesta, open, onClose, onUpdate, etiquetasDisponibles }: CommentModalProps) => {
  const [selectedTags, setSelectedTags] = useState<string[]>(encuesta.etiquetas || []);
  const [newTag, setNewTag] = useState("");
  const [notasInternas, setNotasInternas] = useState(encuesta.notas_internas || "");

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      setSelectedTags((prev) => [...prev, trimmedTag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from("encuestas")
        .update({ 
          etiquetas: selectedTags,
          notas_internas: notasInternas 
        })
        .eq("id", encuesta.id);

      if (error) throw error;

      toast.success("Cambios guardados exitosamente");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error updating data:", error);
      toast.error("Error al guardar cambios");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Detalle del Comentario</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Comment */}
          <div>
            <h4 className="font-semibold mb-2">Comentario:</h4>
            <p className="text-[hsl(var(--imv-gray))] bg-gray-50 p-4 rounded-lg">{encuesta.comentario}</p>
          </div>

          {/* Survey Answers */}
          <div>
            <h4 className="font-semibold mb-3">Resumen de Respuestas:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-[hsl(var(--imv-gray))]">Amabilidad y respeto:</span>
                <span className="font-medium">{encuesta.pregunta1_amabilidad}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-[hsl(var(--imv-gray))]">Tiempo de espera:</span>
                <span className="font-medium">{encuesta.pregunta2_tiempo_espera}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-[hsl(var(--imv-gray))]">Resolución de dudas:</span>
                <span className="font-medium">{encuesta.pregunta3_resolucion_dudas}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-[hsl(var(--imv-gray))]">Limpieza:</span>
                <span className="font-medium">{encuesta.pregunta4_limpieza}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-[hsl(var(--imv-gray))]">Calificación general:</span>
                <span className="font-medium">{encuesta.pregunta5_calificacion_general}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Etiquetas:
            </h4>
            
            {/* Predefined Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {etiquetasDisponibles.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className={`cursor-pointer transition-all ${
                    selectedTags.includes(tag)
                      ? "bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black border-0"
                      : "hover:bg-gray-100"
                  }`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                  {selectedTags.includes(tag) && <X className="ml-1 h-3 w-3" />}
                </Badge>
              ))}
            </div>

            {/* Selected Custom Tags */}
            {selectedTags.filter(tag => !etiquetasDisponibles.includes(tag)).length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-[hsl(var(--imv-gray))] mb-2">Etiquetas personalizadas:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTags
                    .filter(tag => !etiquetasDisponibles.includes(tag))
                    .map((tag) => (
                      <Badge
                        key={tag}
                        className="bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black border-0"
                      >
                        {tag}
                        <X 
                          className="ml-1 h-3 w-3 cursor-pointer" 
                          onClick={() => handleRemoveTag(tag)}
                        />
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {/* Add Custom Tag */}
            <div className="flex gap-2">
              <Input
                placeholder="Crear etiqueta personalizada..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleAddCustomTag();
                  }
                }}
                className="flex-1"
              />
              <Button 
                onClick={handleAddCustomTag}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <h4 className="font-semibold mb-2">Notas Internas:</h4>
            <Textarea
              placeholder="Escribir notas internas (solo visible para administradores)..."
              value={notasInternas}
              onChange={(e) => setNotasInternas(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Metadata */}
          <div className="text-xs text-[hsl(var(--imv-gray))] border-t pt-4">
            <p>Fecha: {new Date(encuesta.fecha_creacion).toLocaleString("es-ES")}</p>
            <p>Estado: {encuesta.estado_kanban}</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black hover:opacity-90"
            >
              Guardar Cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CommentModal;
