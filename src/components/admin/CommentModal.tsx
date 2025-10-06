import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from("encuestas")
        .update({ etiquetas: selectedTags })
        .eq("id", encuesta.id);

      if (error) throw error;

      toast.success("Etiquetas actualizadas");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error updating tags:", error);
      toast.error("Error al actualizar etiquetas");
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
            <div className="flex flex-wrap gap-2">
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
