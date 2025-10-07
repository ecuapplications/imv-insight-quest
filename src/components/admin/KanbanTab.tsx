import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import CommentModal from "./CommentModal";
import { Filter } from "lucide-react";

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

      const { data, error } = await supabase
        .from("encuestas")
        .select("*")
        .not("comentario", "is", null)
        .order("fecha_creacion", { ascending: false });

      if (error) throw error;
      setEncuestas(data || []);
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
      {/* Filters */}
      <Card className="shadow-md">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Tag Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2 min-w-[160px]">
                <Filter className="h-5 w-5 text-[hsl(var(--imv-cyan))]" />
                <span className="font-medium">Filtrar por etiqueta:</span>
              </div>
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
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
            </div>

            {/* Date Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2 min-w-[160px]">
                <Filter className="h-5 w-5 text-[hsl(var(--imv-purple))]" />
                <span className="font-medium">Filtrar por fecha:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Year Filter */}
                <Select value={selectedYear} onValueChange={(value) => {
                  setSelectedYear(value);
                  setSelectedMonth("all");
                  setSelectedDay("all");
                }}>
                  <SelectTrigger className="w-[140px]">
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

                {/* Month Filter */}
                <Select 
                  value={selectedMonth} 
                  onValueChange={(value) => {
                    setSelectedMonth(value);
                    setSelectedDay("all");
                  }}
                  disabled={selectedYear === "all"}
                >
                  <SelectTrigger className="w-[140px]">
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

                {/* Day Filter */}
                <Select 
                  value={selectedDay} 
                  onValueChange={setSelectedDay}
                  disabled={selectedMonth === "all"}
                >
                  <SelectTrigger className="w-[120px]">
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
              </div>
            </div>
          </div>
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
                    onClick={() => setSelectedEncuesta(encuesta)}
                    className="cursor-pointer hover:shadow-lg transition-shadow bg-white"
                  >
                    <CardContent className="p-4 space-y-2">
                      <p className="text-sm line-clamp-3">{encuesta.comentario}</p>
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
