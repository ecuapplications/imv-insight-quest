import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquareText, User, Phone, Search, Calendar } from "lucide-react";
import PeriodFilter from "./PeriodFilter";
import { isWithinRange, type PeriodRange } from "@/lib/dateFilter";

type Encuesta = {
  id: string;
  fecha_creacion: string;
  pregunta1_amabilidad: string;
  pregunta2_tiempo_espera: string;
  pregunta3_resolucion_dudas: string;
  pregunta4_limpieza: string;
  pregunta5_calificacion_general: string;
  comentario: string | null;
  nombre_paciente: string | null;
  apellido_paciente: string | null;
  telefono: string | null;
};

const PREGUNTAS: { label: string; key: keyof Encuesta }[] = [
  { label: "Amabilidad y respeto", key: "pregunta1_amabilidad" },
  { label: "Tiempo de espera", key: "pregunta2_tiempo_espera" },
  { label: "Resolución de dudas", key: "pregunta3_resolucion_dudas" },
  { label: "Limpieza y organización", key: "pregunta4_limpieza" },
  { label: "Calificación general", key: "pregunta5_calificacion_general" },
];

const ComentariosTab = () => {
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<PeriodRange>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchEncuestas();
  }, []);

  const fetchEncuestas = async () => {
    setLoading(true);
    try {
      const { data, error } = await api.get<Encuesta[]>("/encuestas.php");
      if (error) {
        toast.error("Debe iniciar sesión para ver los comentarios");
        return;
      }
      setEncuestas(data || []);
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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return encuestas
      .filter((e) => isWithinRange(new Date(e.fecha_creacion), range))
      .filter((e) => {
        if (query === "") return true;
        const nombreCompleto = `${e.nombre_paciente ?? ""} ${e.apellido_paciente ?? ""}`.toLowerCase();
        const telefono = (e.telefono ?? "").toLowerCase();
        return nombreCompleto.includes(query) || telefono.includes(query);
      });
  }, [encuestas, range, search]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-[hsl(var(--imv-gray))]">Cargando comentarios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-[hsl(var(--imv-cyan))]" />
            <span className="font-medium text-lg">Comentarios</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--imv-gray))]" />
              <Input
                placeholder="Buscar por nombre o teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <PeriodFilter dates={availableDates} onChange={setRange} />
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <p className="text-center text-[hsl(var(--imv-gray))]">
              No hay respuestas que coincidan con el filtro seleccionado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((e) => (
            <Card key={e.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 space-y-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <User className="h-4 w-4 shrink-0 text-[hsl(var(--imv-cyan))]" />
                  <span className="truncate">
                    {e.nombre_paciente
                      ? `${e.nombre_paciente} ${e.apellido_paciente ?? ""}`.trim()
                      : "Anónimo"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[hsl(var(--imv-gray))]">
                  {e.telefono && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {e.telefono}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(e.fecha_creacion).toLocaleDateString("es-EC")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {PREGUNTAS.map(({ label, key }) => (
                    <Badge key={key} variant="outline" className="text-[10px] font-normal">
                      {label}: {e[key] as string}
                    </Badge>
                  ))}
                </div>
                {e.comentario && (
                  <p className="text-sm border-t pt-2 whitespace-pre-wrap">{e.comentario}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ComentariosTab;
