import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Plus, CalendarIcon, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale"; // Importar el idioma español
import { cn } from "@/lib/utils";

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

type Tarea = {
  id?: string;
  nombre: string;
  descripcion: string;
  responsable_id: string;
  fecha_vencimiento: Date;
  estado: "Pendiente" | "Vencida" | "Descartada" | "Resuelta";
};

type Responsable = {
  id: string;
  nombre: string;
  email: string;
};

const CommentModal = ({ encuesta, open, onClose, onUpdate, etiquetasDisponibles }: CommentModalProps) => {
  const [selectedTags, setSelectedTags] = useState<string[]>(encuesta.etiquetas || []);
  const [newTag, setNewTag] = useState("");
  const [notasInternas, setNotasInternas] = useState(encuesta.notas_internas || "");
  
  // Task management state
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<Tarea>({
    nombre: "",
    descripcion: "",
    responsable_id: "",
    fecha_vencimiento: new Date(),
    estado: "Pendiente",
  });
  
  // New responsable form
  const [showNewResponsable, setShowNewResponsable] = useState(false);
  const [newResponsable, setNewResponsable] = useState({ nombre: "", email: "" });

  // Load tasks and responsables
  useEffect(() => {
    if (open) {
      loadTareas();
      loadResponsables();
    }
  }, [open, encuesta.id]);

  const loadTareas = async () => {
    const { data, error } = await supabase
      .from("tareas")
      .select("*")
      .eq("encuesta_id", encuesta.id);

    if (error) {
      console.error("Error loading tasks:", error);
      return;
    }

    setTareas(data.map(t => ({
      ...t,
      fecha_vencimiento: new Date(t.fecha_vencimiento)
    })));
  };

  const loadResponsables = async () => {
    const { data, error } = await supabase
      .from("responsables")
      .select("*")
      .order("nombre");

    if (error) {
      console.error("Error loading responsables:", error);
      return;
    }

    setResponsables(data);
  };

  const handleAddResponsable = async () => {
    if (!newResponsable.nombre.trim() || !newResponsable.email.trim()) {
      toast.error("Nombre y email son requeridos");
      return;
    }

    const { data, error } = await supabase
      .from("responsables")
      .insert([newResponsable])
      .select()
      .single();

    if (error) {
      toast.error("Error al crear responsable");
      console.error(error);
      return;
    }

    setResponsables([...responsables, data]);
    setTaskForm({ ...taskForm, responsable_id: data.id });
    setNewResponsable({ nombre: "", email: "" });
    setShowNewResponsable(false);
    toast.success("Responsable creado exitosamente");
  };

  const handleSaveTask = async () => {
    if (!taskForm.nombre.trim() || !taskForm.responsable_id) {
      toast.error("Nombre y responsable son requeridos");
      return;
    }

    // Determinar el estado correcto
    let estadoFinal = taskForm.estado;
    const fechaVencimiento = new Date(taskForm.fecha_vencimiento);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaVencimiento.setHours(0, 0, 0, 0);

    // Si es una tarea vencida que se está replanificando con fecha futura, volver a Pendiente
    if (taskForm.estado === "Vencida" && fechaVencimiento > hoy) {
      estadoFinal = "Pendiente";
    }

    if (editingTaskId) {
      // Update existing task
      const { error } = await supabase
        .from("tareas")
        .update({
          nombre: taskForm.nombre,
          descripcion: taskForm.descripcion,
          responsable_id: taskForm.responsable_id,
          fecha_vencimiento: taskForm.fecha_vencimiento.toISOString().split('T')[0],
          estado: estadoFinal,
        })
        .eq("id", editingTaskId);

      if (error) {
        toast.error("Error al actualizar tarea");
        console.error(error);
        return;
      }

      toast.success("Tarea actualizada");
    } else {
      // Create new task
      const { error } = await supabase
        .from("tareas")
        .insert([{
          encuesta_id: encuesta.id,
          nombre: taskForm.nombre,
          descripcion: taskForm.descripcion,
          responsable_id: taskForm.responsable_id,
          fecha_vencimiento: taskForm.fecha_vencimiento.toISOString().split('T')[0],
          estado: estadoFinal,
        }]);

      if (error) {
        toast.error("Error al crear tarea");
        console.error(error);
        return;
      }

      toast.success("Tarea creada");
    }

    setShowTaskForm(false);
    setEditingTaskId(null);
    setTaskForm({
      nombre: "",
      descripcion: "",
      responsable_id: "",
      fecha_vencimiento: new Date(),
      estado: "Pendiente",
    });
    
    // **AQUÍ LA ACTUALIZACIÓN**
    onUpdate(); // Notifica al componente padre (KanbanTab) para que recargue los datos
    loadTareas();
  };

  const handleEditTask = (tarea: any) => {
    setTaskForm({
      nombre: tarea.nombre,
      descripcion: tarea.descripcion,
      responsable_id: tarea.responsable_id,
      fecha_vencimiento: new Date(tarea.fecha_vencimiento),
      estado: tarea.estado,
    });
    setEditingTaskId(tarea.id);
    setShowTaskForm(true);
  };

  const handleDeleteTask = async (tareaId: string) => {
    const { error } = await supabase
      .from("tareas")
      .delete()
      .eq("id", tareaId);

    if (error) {
      toast.error("Error al eliminar tarea");
      console.error(error);
      return;
    }

    toast.success("Tarea eliminada");
    
    // **AQUÍ LA ACTUALIZACIÓN**
    onUpdate(); // Notifica al componente padre (KanbanTab) para que recargue los datos
    loadTareas();
  };

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

          {/* Tasks Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Tareas:</h4>
              <Button
                onClick={() => {
                  setShowTaskForm(!showTaskForm);
                  setEditingTaskId(null);
                  setTaskForm({
                    nombre: "",
                    descripcion: "",
                    responsable_id: "",
                    fecha_vencimiento: new Date(),
                    estado: "Pendiente",
                  });
                }}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Añadir Tarea
              </Button>
            </div>

            {/* Task Form */}
            {showTaskForm && (
              <div className="border rounded-lg p-4 mb-4 space-y-3 bg-gray-50">
                <Input
                  placeholder="Nombre de la tarea"
                  value={taskForm.nombre}
                  onChange={(e) => setTaskForm({ ...taskForm, nombre: e.target.value })}
                />
                
                <Textarea
                  placeholder="Descripción de la tarea"
                  value={taskForm.descripcion}
                  onChange={(e) => setTaskForm({ ...taskForm, descripcion: e.target.value })}
                  className="min-h-[80px]"
                />

                <div>
                  <label className="text-sm font-medium mb-2 block">Responsable:</label>
                  <Select
                    value={taskForm.responsable_id}
                    onValueChange={(value) => {
                      if (value === "new") {
                        setShowNewResponsable(true);
                      } else {
                        setTaskForm({ ...taskForm, responsable_id: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar responsable" />
                    </SelectTrigger>
                    <SelectContent>
                      {responsables.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nombre} ({r.email})
                        </SelectItem>
                      ))}
                      <SelectItem value="new">
                        <Plus className="h-4 w-4 inline mr-1" />
                        Añadir nuevo responsable
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {showNewResponsable && (
                    <div className="mt-2 p-3 border rounded bg-white space-y-2">
                      <Input
                        placeholder="Nombre del responsable"
                        value={newResponsable.nombre}
                        onChange={(e) => setNewResponsable({ ...newResponsable, nombre: e.target.value })}
                      />
                      <Input
                        placeholder="Email del responsable"
                        type="email"
                        value={newResponsable.email}
                        onChange={(e) => setNewResponsable({ ...newResponsable, email: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleAddResponsable} size="sm">Guardar</Button>
                        <Button onClick={() => setShowNewResponsable(false)} variant="outline" size="sm">
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Fecha de Vencimiento:</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !taskForm.fecha_vencimiento && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {taskForm.fecha_vencimiento ? (
                          format(taskForm.fecha_vencimiento, "PPP", { locale: es })
                        ) : (
                          <span>Seleccionar fecha</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={taskForm.fecha_vencimiento}
                        onSelect={(date) => date && setTaskForm({ ...taskForm, fecha_vencimiento: date })}
                        initialFocus
                        locale={es}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Estado:</label>
                  <Select
                    value={taskForm.estado}
                    onValueChange={(value: any) => setTaskForm({ ...taskForm, estado: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendiente">Pendiente</SelectItem>
                      <SelectItem value="Descartada">Descartada</SelectItem>
                      <SelectItem value="Resuelta">Resuelta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveTask}>
                    {editingTaskId ? "Actualizar" : "Guardar"} Tarea
                  </Button>
                  <Button
                    onClick={() => {
                      setShowTaskForm(false);
                      setEditingTaskId(null);
                    }}
                    variant="outline"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Task List */}
            <div className="space-y-2">
              {tareas.map((tarea: any) => {
                const responsable = responsables.find(r => r.id === tarea.responsable_id);
                return (
                  <div
                    key={tarea.id}
                    className="border rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium">{tarea.nombre}</h5>
                        {tarea.descripcion && (
                          <p className="text-sm text-[hsl(var(--imv-gray))] mt-1">{tarea.descripcion}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          <Badge variant="outline">
                            {responsable?.nombre || "Sin responsable"}
                          </Badge>
                          <Badge variant="outline">
                            {format(new Date(tarea.fecha_vencimiento), "dd/MM/yyyy")}
                          </Badge>
                          <Badge
                            className={
                              tarea.estado === "Resuelta"
                                ? "bg-green-100 text-green-800"
                                : tarea.estado === "Vencida"
                                ? "bg-red-100 text-red-800"
                                : tarea.estado === "Descartada"
                                ? "bg-gray-100 text-gray-800"
                                : "bg-yellow-100 text-yellow-800"
                            }
                          >
                            {tarea.estado}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button
                          onClick={() => handleEditTask(tarea)}
                          variant="ghost"
                          size="sm"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteTask(tarea.id)}
                          variant="ghost"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {tareas.length === 0 && !showTaskForm && (
                <p className="text-sm text-[hsl(var(--imv-gray))] text-center py-4">
                  No hay tareas asignadas
                </p>
              )}
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