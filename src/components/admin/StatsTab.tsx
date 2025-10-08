import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Calendar, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

type FilterType = "day" | "week" | "month" | "year";

type EncuestaData = {
  pregunta1_amabilidad: string;
  pregunta2_tiempo_espera: string;
  pregunta3_resolucion_dudas: string;
  pregunta4_limpieza: string;
  pregunta5_calificacion_general: string;
  fecha_creacion: string;
};

const COLORS = {
  primary: "hsl(187 100% 59%)",
  secondary: "hsl(261 100% 78%)",
  tertiary: "hsl(0 0% 43%)",
  quaternary: "hsl(200 100% 70%)",
  quinary: "hsl(280 100% 85%)",
};

const chartDetails = [
  { title: "Amabilidad y Respeto", dataKey: "pregunta1_amabilidad" as keyof EncuestaData },
  { title: "Tiempo de Espera", dataKey: "pregunta2_tiempo_espera" as keyof EncuestaData },
  { title: "Resolución de Dudas", dataKey: "pregunta3_resolucion_dudas" as keyof EncuestaData },
  { title: "Limpieza y Organización", dataKey: "pregunta4_limpieza" as keyof EncuestaData },
  { title: "Calificación General", dataKey: "pregunta5_calificacion_general" as keyof EncuestaData },
];

const StatsTab = () => {
  const [filter, setFilter] = useState<FilterType>("month");
  const [responses, setResponses] = useState<EncuestaData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResponses();
  }, [filter]);

  const fetchResponses = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("Debe iniciar sesión para ver las estadísticas");
        return;
      }
      let query = supabase.from("encuestas").select("pregunta1_amabilidad, pregunta2_tiempo_espera, pregunta3_resolucion_dudas, pregunta4_limpieza, pregunta5_calificacion_general, fecha_creacion");
      const now = new Date();
      let startDate = new Date();
      switch (filter) {
        case "day": startDate.setHours(0, 0, 0, 0); break;
        case "week": startDate.setDate(now.getDate() - 7); break;
        case "month": startDate.setMonth(now.getMonth() - 1); break;
        case "year": startDate.setFullYear(now.getFullYear() - 1); break;
      }
      query = query.gte("fecha_creacion", startDate.toISOString());
      const { data, error } = await query;
      if (error) throw error;
      setResponses(data || []);
    } catch (error) {
      console.error("Error fetching responses:", error);
      toast.error("Error al cargar las estadísticas");
    } finally {
      setLoading(false);
    }
  };

  const getChartData = (key: keyof EncuestaData) => {
    const counts: Record<string, number> = {};
    responses.forEach((response) => {
      const value = response[key];
      counts[value] = (counts[value] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const ChartCard = ({ title, dataKey }: { title: string; dataKey: keyof EncuestaData }) => {
    const data = getChartData(dataKey);
    const colors = [COLORS.primary, COLORS.secondary, COLORS.tertiary, COLORS.quaternary, COLORS.quinary];

    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg text-center">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
                className="text-xs"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* --- CAMBIO AQUÍ: Contenedor Flex para las dos tarjetas superiores --- */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filtro (70% del ancho en pantallas grandes) */}
        <Card className="shadow-md w-full lg:w-[70%]">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[hsl(var(--imv-cyan))]" />
                <span className="font-medium">Filtrar por período:</span>
              </div>
              <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Día</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="year">Año</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Total de Respuestas (30% del ancho en pantallas grandes) */}
        <Card className="shadow-md bg-gradient-to-r from-[hsl(var(--imv-cyan)/0.1)] to-[hsl(var(--imv-purple)/0.1)] w-full lg:w-[30%]">
          <CardContent className="pt-6 flex flex-col justify-center h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[hsl(var(--imv-gray))]">Total de Respuestas</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] bg-clip-text text-transparent">
                  {responses.length}
                </p>
              </div>
              <TrendingUp className="h-12 w-12 text-[hsl(var(--imv-cyan))]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-12"><p className="text-[hsl(var(--imv-gray))]">Cargando estadísticas...</p></div>
      ) : responses.length === 0 ? (
        <Card className="shadow-md"><CardContent className="pt-6"><p className="text-center text-[hsl(var(--imv-gray))]">No hay respuestas en el período seleccionado</p></CardContent></Card>
      ) : (
        <Carousel
          opts={{ align: "start" }}
          className="w-full max-w-xs sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto"
        >
          <CarouselContent>
            {chartDetails.map((detail, index) => (
              <CarouselItem key={index} className="sm:basis-1/2 lg:basis-1/3">
                <div className="p-1">
                  <ChartCard title={detail.title} dataKey={detail.dataKey} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      )}
    </div>
  );
};

export default StatsTab;