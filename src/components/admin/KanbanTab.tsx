import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import CommentModal from "./CommentModal";
import { Filter, MoveRight, ListChecks, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PeriodFilter from "./PeriodFilter";
import { isWithinRange, type PeriodRange } from "@/lib/dateFilter";
import { ESTADOS, getEstadoLabel, getEstadoIcon } from "@/lib/estadoKanban";

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
  nombre_paciente?: string | null;
  apellido_paciente?: string | null;
  telefono?: string | null;
  tarea?: {
    responsable_nombre: string;
    fecha_vencimiento: string;
    estado: string;
  } | null;
};

type Etiqueta = {
  id: string;
  nombre: string;
};

const KanbanTab = () => {
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [etiquetasDisponibles, setEtiquetasDisponibles] = useState<Etiqueta[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [tagSearchQuery, setTagSearchQuery] = useState<string>("");
  const [range, setRange] = useState<PeriodRange>(null);
  const [selectedEncuesta, setSelectedEncuesta] = useState<Encuesta | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEncuestas();
    fetchEtiquetas();
  }, []);

  const fetchEtiquetas = async () => {
    try {
      const { data, error } = await api.get<Etiqueta[]>("/etiquetas.php");
      if (error) throw new Error(error);
      setEtiquetasDisponibles(data || []);
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  const fetchEncuestas = async () => {
    setLoading(true);
    try {
      const { data: encuestasData, error } = await api.get<any[]>("/encuestas.php?with_comment=1");
      if (error) {
        toast.error("Debe iniciar sesión para ver los comentarios");
        setLoading(false);
        return;
      }

      const encuestasConTareas = await Promise.all(
        (encuestasData || []).map(async (encuesta) => {
          const { data: tareasData, error: tareasError } = await api.get<any[]>(
            `/tareas.php?encuesta_id=${encuesta.id}`
          );

          if (tareasError) {
            console.error(`Error al buscar tarea para la encuesta ${encuesta.id}:`, tareasError);
            return { ...encuesta, tarea: null };
          }

          const tarea = tareasData && tareasData.length > 0 ? tareasData[0] : null;

          if (tarea) {
            return {
              ...encuesta,
              tarea: {
                responsable_nombre: tarea.responsable_nombre || "Sin responsable",
                fecha_vencimiento: tarea.fecha_vencimiento,
                estado: tarea.estado,
              },
            };
          }
          return { ...encuesta, tarea: null };
        })
      );

      setEncuestas(encuestasConTareas);
    } catch (error) {
      console.error("Error fetching encuestas:", error);
      toast.error("Error al cargar los comentarios");
    } finally {
      setLoading(false);
    }
  };






  const availableDates = useMemo(
    () => encuestas.map((e) => new Date(e.fecha_creacion)),
    [encuestas],
  );

  const filteredEncuestas = useMemo(() => {
    let filtered = encuestas;
    if (selectedTag === "sin-etiqueta") {
      filtered = filtered.filter((e) => !e.etiquetas || e.etiquetas.length === 0);
    } else if (selectedTag !== "all") {
      filtered = filtered.filter((e) => e.etiquetas && e.etiquetas.includes(selectedTag));
    }
    filtered = filtered.filter((e) => isWithinRange(new Date(e.fecha_creacion), range));
    return filtered;
  }, [encuestas, selectedTag, range]);

  // ... (el resto de las funciones como handleDragStart, handleDrop, etc. no cambian)
  const handleDragStart = (e: React.DragEvent, encuestaId: string) => {
    setDraggedItem(encuestaId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDrop = async (e: React.DragEvent, nuevoEstado: string) => {
    e.preventDefault();
    if (!draggedItem) return;
    try {
      const { error } = await api.patch(`/encuestas.php?id=${draggedItem}`, { estado_kanban: nuevoEstado });
      if (error) throw new Error(error);
      setEncuestas((prev) => prev.map((enc) => (enc.id === draggedItem ? { ...enc, estado_kanban: nuevoEstado } : enc)));
      toast.success("Comentario movido exitosamente");
    } catch (error) {
      toast.error("Error al mover el comentario");
    } finally {
      setDraggedItem(null);
    }
  };
  const handleMoveCard = async (encuestaId: string, nuevoEstado: string) => {
    try {
      const { error } = await api.patch(`/encuestas.php?id=${encuestaId}`, { estado_kanban: nuevoEstado });
      if (error) throw new Error(error);
      setEncuestas((prev) => prev.map((enc) => (enc.id === encuestaId ? { ...enc, estado_kanban: nuevoEstado } : enc)));
      toast.success("Comentario movido exitosamente");
    } catch (error) {
      toast.error("Error al mover el comentario");
    }
  };
  const getEncuestasByEstado = (estado: string) => {
    return filteredEncuestas.filter((e) => e.estado_kanban === estado);
  };


  if (loading) {
    return <div className="text-center py-12"><p className="text-[hsl(var(--imv-gray))]">Cargando comentarios...</p></div>;
  }

  const filteredTags = etiquetasDisponibles.filter((tag) =>
    tag.nombre.toLowerCase().includes(tagSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-4">
            
            <div className="flex items-center gap-2 mb-4 lg:mb-0 flex-shrink-0">
              <Filter className="h-5 w-5 text-[hsl(var(--imv-cyan))]" />
              <span className="font-medium text-lg">Filtros</span>
            </div>
            
            <div className="flex flex-col gap-4 w-full">
              {/* Tag Filter with Search */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--imv-gray))]" />
                  <Input
                    placeholder="Buscar etiqueta..."
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <div className="relative">
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    <Badge
                      variant={selectedTag === "all" ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer whitespace-nowrap flex-shrink-0 transition-all",
                        selectedTag === "all"
                          ? "bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black"
                          : "hover:bg-gray-100"
                      )}
                      onClick={() => setSelectedTag("all")}
                    >
                      Todas
                    </Badge>
                    <Badge
                      variant={selectedTag === "sin-etiqueta" ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer whitespace-nowrap flex-shrink-0 transition-all",
                        selectedTag === "sin-etiqueta"
                          ? "bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black"
                          : "hover:bg-gray-100"
                      )}
                      onClick={() => setSelectedTag("sin-etiqueta")}
                    >
                      Sin Etiqueta
                    </Badge>
                    {filteredTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={selectedTag === tag.nombre ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer whitespace-nowrap flex-shrink-0 transition-all",
                          selectedTag === tag.nombre
                            ? "bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black"
                            : "hover:bg-gray-100"
                        )}
                        onClick={() => setSelectedTag(tag.nombre)}
                      >
                        {tag.nombre}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Date Filter */}
              <PeriodFilter dates={availableDates} onChange={setRange} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {ESTADOS.map((estado) => {
          const items = getEncuestasByEstado(estado);
          const EstadoIcon = getEstadoIcon(estado);
          return (
            <div
              key={estado}
              className="bg-[hsl(var(--kanban-column))] rounded-lg p-4 min-h-[500px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, estado)}
            >
              <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                <EstadoIcon className="h-4 w-4 shrink-0 text-[hsl(var(--imv-gray))]" />
                {getEstadoLabel(estado)}
              </h3>
              <p className="text-xs text-[hsl(var(--imv-gray))] mb-4">{items.length} comentarios</p>
              <div className="space-y-3">
                {items.map((encuesta) => (
                  <Card key={encuesta.id} draggable onDragStart={(e) => handleDragStart(e, encuesta.id)} className="cursor-pointer hover:shadow-lg transition-shadow bg-white relative">
                    <CardContent className="p-4 space-y-2" onClick={() => setSelectedEncuesta(encuesta)}>
                       {/* ... El resto del componente de la tarjeta no cambia ... */}
                       <TooltipProvider>
                        <Tooltip>
                          <DropdownMenu>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center shadow-md z-10"
                                  aria-label="Mover tarjeta"
                                >
                                  <MoveRight className="h-4 w-4 text-white" />
                                </button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Mover tarjeta a:</p>
                            </TooltipContent>
                            <DropdownMenuContent align="end" className="w-64">
                              {ESTADOS.filter((e) => e !== estado).map((destino) => {
                                const DestinoIcon = getEstadoIcon(destino);
                                return (
                                  <DropdownMenuItem
                                    key={destino}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveCard(encuesta.id, destino);
                                    }}
                                    className="cursor-pointer gap-2"
                                  >
                                    <DestinoIcon className="h-4 w-4 shrink-0" />
                                    {getEstadoLabel(destino)}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Tooltip>
                      </TooltipProvider>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--imv-gray))]">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {encuesta.nombre_paciente
                            ? `${encuesta.nombre_paciente} ${encuesta.apellido_paciente ?? ""}`.trim()
                            : "Anónimo"}
                        </span>
                        {encuesta.telefono && (
                          <span className="text-[10px] text-[hsl(var(--imv-gray))]/80 shrink-0">
                            · {encuesta.telefono}
                          </span>
                        )}
                      </div>
                      <p className="text-sm line-clamp-3 pr-8">{encuesta.comentario}</p>
                      <div className="flex flex-wrap gap-1">
                        {encuesta.etiquetas?.map((tag) => <Badge key={tag} variant="secondary" className="text-xs bg-gradient-to-r from-[hsl(var(--imv-cyan)/0.2)] to-[hsl(var(--imv-purple)/0.2)]">{tag}</Badge>)}
                      </div>
                      {encuesta.tarea && (
                        <div className="flex items-center gap-2 text-xs bg-gray-50 p-2 rounded border border-gray-200 mt-2">
                          <ListChecks className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span className="font-medium truncate">{encuesta.tarea.responsable_nombre}</span>
                          <span className="text-[hsl(var(--imv-gray))]">•</span>
                          <span className="text-[hsl(var(--imv-gray))]">
                            {new Date(encuesta.tarea.fecha_vencimiento).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </span>
                          <Badge className={cn("ml-auto flex-shrink-0", encuesta.tarea.estado === "Pendiente" && "bg-yellow-200 text-yellow-900 hover:bg-yellow-200", encuesta.tarea.estado === "Resuelta" && "bg-green-200 text-green-900 hover:bg-green-200", encuesta.tarea.estado === "Vencida" && "bg-red-200 text-red-900 hover:bg-red-200", encuesta.tarea.estado === "Descartada" && "bg-gray-200 text-gray-900 hover:bg-gray-200")}>
                            {encuesta.tarea.estado}
                          </Badge>
                        </div>
                      )}
                      <p className="text-xs text-[hsl(var(--imv-gray))]">{new Date(encuesta.fecha_creacion).toLocaleDateString("es-ES")}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedEncuesta && (
        <CommentModal
          encuesta={selectedEncuesta}
          open={!!selectedEncuesta}
          onClose={() => setSelectedEncuesta(null)}
          onUpdate={fetchEncuestas}
        />
      )}
    </div>
  );
};

export default KanbanTab;