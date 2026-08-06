import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Tag } from "lucide-react";

type Etiqueta = {
  id: string;
  nombre: string;
  created_at: string;
};

const TagsManagementTab = () => {
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(true);
  const [tagToDelete, setTagToDelete] = useState<Etiqueta | null>(null);

  useEffect(() => {
    fetchEtiquetas();
  }, []);

  const fetchEtiquetas = async () => {
    setLoading(true);
    try {
      const { data, error } = await api.get<Etiqueta[]>("/etiquetas.php");
      if (error) throw new Error(error);
      setEtiquetas(data || []);
    } catch (error) {
      console.error("Error fetching tags:", error);
      toast.error("Error al cargar las etiquetas");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    const trimmedName = newTagName.trim();

    if (!trimmedName) {
      toast.error("El nombre de la etiqueta no puede estar vacío");
      return;
    }

    if (etiquetas.some(e => e.nombre.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error("Ya existe una etiqueta con ese nombre");
      return;
    }

    try {
      const { error } = await api.post("/etiquetas.php", { nombre: trimmedName });
      if (error) throw new Error(error);

      toast.success("Etiqueta creada exitosamente");
      setNewTagName("");
      fetchEtiquetas();
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.error("Error al crear la etiqueta");
    }
  };

  const handleDeleteTag = async () => {
    if (!tagToDelete) return;

    try {
      const { data: encuestasConTag, error: fetchError } = await api.get<{ id: string; etiquetas: string[] }[]>(
        "/encuestas.php?with_comment=1"
      );
      if (fetchError) throw new Error(fetchError);

      const afectadas = (encuestasConTag || []).filter((e) => (e.etiquetas || []).includes(tagToDelete.nombre));
      for (const encuesta of afectadas) {
        const updatedTags = (encuesta.etiquetas || []).filter((tag) => tag !== tagToDelete.nombre);
        const { error: updateError } = await api.patch(`/encuestas.php?id=${encuesta.id}`, { etiquetas: updatedTags });
        if (updateError) throw new Error(updateError);
      }

      const { error: deleteError } = await api.del(`/etiquetas.php?id=${tagToDelete.id}`);
      if (deleteError) throw new Error(deleteError);

      toast.success(`Etiqueta "${tagToDelete.nombre}" eliminada exitosamente`);
      setTagToDelete(null);
      fetchEtiquetas();
    } catch (error) {
      console.error("Error deleting tag:", error);
      toast.error("Error al eliminar la etiqueta");
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-[hsl(var(--imv-gray))]">Cargando etiquetas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Tag Card */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-[hsl(var(--imv-cyan))]" />
            Crear Nueva Etiqueta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Nombre de la nueva etiqueta..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleCreateTag();
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleCreateTag}
              className="bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tags List Card */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-[hsl(var(--imv-cyan))]" />
            Etiquetas Existentes ({etiquetas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {etiquetas.length === 0 ? (
            <p className="text-center text-[hsl(var(--imv-gray))] py-8">
              No hay etiquetas creadas aún
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {etiquetas.map((etiqueta) => (
                <div
                  key={etiqueta.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <Badge
                    variant="secondary"
                    className="bg-gradient-to-r from-[hsl(var(--imv-cyan)/0.2)] to-[hsl(var(--imv-purple)/0.2)]"
                  >
                    {etiqueta.nombre}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTagToDelete(etiqueta)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!tagToDelete} onOpenChange={() => setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar etiqueta?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está usted seguro que desea eliminar la etiqueta{" "}
              <strong>"{tagToDelete?.nombre}"</strong>?
              <br />
              <br />
              Esta etiqueta será removida de todos los comentarios que la tengan asignada.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTag}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TagsManagementTab;
