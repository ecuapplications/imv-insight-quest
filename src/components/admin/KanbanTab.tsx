import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import CommentModal from "./CommentModal";
import { Filter, MoveRight, ListChecks } from "lucide-react";
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
  tarea?: {
    responsable_nombre: string;
    fecha_vencimiento: string;
    estado: string;
  } | null;
};

const ESTADOS = [
  "Bandeja de Entrada",
  "Felicitaciones y Reconocimientos 👍",
  "Sugerencias de Mejora 💡",
  "Áreas de Oportunidad (Quejas) ⚠️",
  "Archivado / Resuelto ✅",
];

const ETIQUETAS_DISPONIBLES = [
  "Atención y Trato",
  "Tiempos de Espera",
  "Claridad de la Información",
  "Procesos y Trámites",
  "Instalaciones",
  "Resolución de Problemas",
];

const KanbanTab = () => {
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [filteredEncuestas, setFilteredEncuestas] = useState<Encuesta[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [selectedEncuesta, setSelectedEncuesta] = useState<Encuesta | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEncuestas();
  }, []);

  useEffect(() => {
    filterEncuestas();
  }, [encuestas, selectedTag, selectedYear, selectedMonth, selectedDay]);

  const fetchEncuestas = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        toast.error("Debe iniciar sesión para ver los comentarios");
        return;
      }

      const { data: encuestasData, error } = await supabase
        .from("encuestas")
        .select("*")
        .not("comentario", "is", null)
        .order("fecha_creacion", { ascending: false });

      if (error) throw error;

      // Cargar tareas y responsables para cada encuesta
      const encuestasConTareas = await Promise.all(
        (encuestasData || []).map(async (encuesta) => {
          const { data: tareasData } = await supabase
            .from("tareas")
            .select(`
              *,
              responsables (nombre)
            `)
            .eq("encuesta_id", encuesta.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .single();

          // Verificar si la tarea está vencida
          if (tareasData) {
            const fechaVencimiento = new Date(tareasData.fecha_vencimiento);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            fechaVencimiento.setHours(0, 0, 0, 0);

            let estadoActual = tareasData.estado;

            // Auto-actualizar a Vencida si corresponde
            if (estadoActual === "Pendiente" && fechaVencimiento < hoy) {
              estadoActual = "Vencida";
              // Actualizar en base de datos
              await supabase
                .from("tareas")
                .update({ estado: "Vencida" })
                .eq("id", tareasData.id);
            }

            return {
              ...encuesta,
              tarea: tareasData ? {
                responsable_nombre: tareasData.responsables?.nombre || "Sin responsable",
                fecha_vencimiento: tareasData.fecha_vencimiento,
                estado: estadoActual,
              } : null,
            };
          }

          return {
            ...encuesta,
            tarea: null,
          };
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

  const filterEncuestas = () => {
    let filtered = encuestas;

    // Filter by tag
    if (selectedTag === "sin-etiqueta") {
      filtered = filtered.filter((e) => !e.etiquetas || e.etiquetas.length === 0);
    } else if (selectedTag !== "all") {
      filtered = filtered.filter((e) => e.etiquetas && e.etiquetas.includes(selectedTag));
    }

    // Filter by date
    filtered = filtered.filter((e) => {
      const fecha = new Date(e.fecha_creacion);
      
      if (selectedYear !== "all") {
        if (fecha.getFullYear() !== parseInt(selectedYear)) return false;
        
        if (selectedMonth !== "all") {
          if (fecha.getMonth() !== parseInt(selectedMonth)) return false;
          
          if (selectedDay !== "all") {
            if (fecha.getDate() !== parseInt(selectedDay)) return false;
          }
        }
      }
      
      return true;
    });

    setFilteredEncuestas(filtered);
  };

  // Get unique years from encuestas
  const getAvailableYears = () => {
    const years = new Set<number>();
    encuestas.forEach((e) => {
      const year = new Date(e.fecha_creacion).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  // Get days in selected month
  const getDaysInMonth = () => {
    if (selectedYear === "all" || selectedMonth === "all") return [];
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

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
      const { error } = await supabase
        .from("encuestas")
        .update({ estado_kanban: nuevoEstado })
        .eq("id", draggedItem);

      if (error) throw error;

      setEncuestas((prev) =>
        prev.map((enc) =>
          enc.id === draggedItem ? { ...enc, estado_kanban: nuevoEstado } : enc
        )
      );

      toast.success("Comentario movido exitosamente");
    } catch (error) {
      console.error("Error updating estado:", error);
      toast.error("Error al mover el comentario");
    } finally {
      setDraggedItem(null);
    }
  };

  const handleMoveCard = async (encuestaId: string, nuevoEstado: string) => {
    try {
      const { error } = await supabase
        .from("encuestas")
        .update({ estado_kanban: nuevoEstado })
        .eq("id", encuestaId);

      if (error) throw error;

      setEncuestas((prev) =>
        prev.map((enc) =>
          enc.id === encuestaId ? { ...enc, estado_kanban: nuevoEstado } : enc
        )
      );

      toast.success("Comentario movido exitosamente");
    } catch (error) {
      console.error("Error updating estado:", error);
      toast.error("Error al mover el comentario");
    }
  };

  const getEncuestasByEstado = (estado: string) => {
    return filteredEncuestas.filter((e) => e.estado_kanban === estado);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-[hsl(var(--imv-gray))]">Cargando comentarios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="shadow-md">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-[hsl(var(--imv-cyan))]" />
            <span className="font-medium text-lg">Filtros</span>
          </div>
          
          <TooltipProvider>
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Tag Filter */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Select value={selectedTag} onValueChange={setSelectedTag}>
                    <SelectTrigger className="w-full lg:w-[240px]">
                      <SelectValue placeholder="Etiqueta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las etiquetas</SelectItem>
                      <SelectItem value="sin-etiqueta">Sin Etiqueta</SelectItem>
                      {ETIQUETAS_DISPONIBLES.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filtra los comentarios por etiqueta.</p>
                </TooltipContent>
              </Tooltip>

              {/* Year Filter */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Select value={selectedYear} onValueChange={(value) => {
                    setSelectedYear(value);
                    setSelectedMonth("all");
                    setSelectedDay("all");
                  }}>
                    <SelectTrigger className="w-full lg:w-[140px]">
                      <SelectValue placeholder="Año" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los años</SelectItem>
                      {getAvailableYears().map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filtra por año de creación.</p>
                </TooltipContent>
              </Tooltip>

              {/* Month Filter */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Select 
                    value={selectedMonth} 
                    onValueChange={(value) => {
                      setSelectedMonth(value);
                      setSelectedDay("all");
                    }}
                    disabled={selectedYear === "all"}
                  >
                    <SelectTrigger className="w-full lg:w-[140px]">
                      <SelectValue placeholder="Mes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los meses</SelectItem>
                      <SelectItem value="0">Enero</SelectItem>
                      <SelectItem value="1">Febrero</SelectItem>
                      <SelectItem value="2">Marzo</SelectItem>
                      <SelectItem value="3">Abril</SelectItem>
                      <SelectItem value="4">Mayo</SelectItem>
                      <SelectItem value="5">Junio</SelectItem>
                      <SelectItem value="6">Julio</SelectItem>
                      <SelectItem value="7">Agosto</SelectItem>
                      <SelectItem value="8">Septiembre</SelectItem>
                      <SelectItem value="9">Octubre</SelectItem>
                      <SelectItem value="10">Noviembre</SelectItem>
                      <SelectItem value="11">Diciembre</SelectItem>
                    </SelectContent>
                  </Select>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filtra por mes (debes seleccionar un año).</p>
                </TooltipContent>
              </Tooltip>

              {/* Day Filter */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Select 
                    value={selectedDay} 
                    onValueChange={setSelectedDay}
                    disabled={selectedMonth === "all"}
                  >
                    <SelectTrigger className="w-full lg:w-[120px]">
                      <SelectValue placeholder="Día" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los días</SelectItem>
                      {getDaysInMonth().map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filtra por día (debes seleccionar un mes).</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {ESTADOS.map((estado) => {
          const items = getEncuestasByEstado(estado);
          return (
            <div
              key={estado}
              className="bg-[hsl(var(--kanban-column))] rounded-lg p-4 min-h-[500px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, estado)}
            >
              <div className="mb-4">
                <h3 className="font-semibold text-sm mb-1">{estado}</h3>
                <p className="text-xs text-[hsl(var(--imv-gray))]">{items.length} comentarios</p>
              </div>

              <div className="space-y-3">
                {items.map((encuesta) => (
                  <Card
                    key={encuesta.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, encuesta.id)}
                    className="cursor-pointer hover:shadow-lg transition-shadow bg-white relative"
                  >
                    <CardContent className="p-4 space-y-2" onClick={() => setSelectedEncuesta(encuesta)}>
                      {/* Move button */}
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
                              {ESTADOS.filter((e) => e !== estado).map((destino) => (
                                <DropdownMenuItem
                                  key={destino}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveCard(encuesta.id, destino);
                                  }}
                                  className="cursor-pointer"
                                >
                                  {destino}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Tooltip>
                      </TooltipProvider>

                      <p className="text-sm line-clamp-3 pr-8">{encuesta.comentario}</p>
                      
                      <div className="flex flex-wrap gap-1">
                        {encuesta.etiquetas?.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs bg-gradient-to-r from-[hsl(var(--imv-cyan)/0.2)] to-[hsl(var(--imv-purple)/0.2)]"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      {/* Resumen de Tarea */}
                      {encuesta.tarea && (
                        <div className="flex items-center gap-2 text-xs bg-gray-50 p-2 rounded border border-gray-200 mt-2">
                          <ListChecks className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span className="font-medium truncate">{encuesta.tarea.responsable_nombre}</span>
                          <span className="text-[hsl(var(--imv-gray))]">•</span>
                          <span className="text-[hsl(var(--imv-gray))]">
                            {new Date(encuesta.tarea.fecha_vencimiento).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric"
                            })}
                          </span>
                          <Badge
                            className={cn(
                              "ml-auto flex-shrink-0",
                              encuesta.tarea.estado === "Pendiente" && "bg-yellow-200 text-yellow-900 hover:bg-yellow-200",
                              encuesta.tarea.estado === "Resuelta" && "bg-green-200 text-green-900 hover:bg-green-200",
                              encuesta.tarea.estado === "Vencida" && "bg-red-200 text-red-900 hover:bg-red-200",
                              encuesta.tarea.estado === "Descartada" && "bg-gray-200 text-gray-900 hover:bg-gray-200"
                            )}
                          >
                            {encuesta.tarea.estado}
                          </Badge>
                        </div>
                      )}

                      <p className="text-xs text-[hsl(var(--imv-gray))]">
                        {new Date(encuesta.fecha_creacion).toLocaleDateString("es-ES")}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Comment Modal */}
      {selectedEncuesta && (
        <CommentModal
          encuesta={selectedEncuesta}
          open={!!selectedEncuesta}
          onClose={() => setSelectedEncuesta(null)}
          onUpdate={fetchEncuestas}
          etiquetasDisponibles={ETIQUETAS_DISPONIBLES}
        />
      )}
    </div>
  );
};

export default KanbanTab;