import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import PeriodFilter from "./PeriodFilter";
import { isWithinRange, type PeriodRange } from "@/lib/dateFilter";

type RegistroSospechoso = {
  id: string;
  fecha_creacion: string;
  ip_address: string | null;
  comentario: string | null;
};

type DispositivoSospechoso = {
  device_id: string;
  total: number;
  registros: RegistroSospechoso[];
};

const SuspiciousDevicesTab = () => {
  const [dispositivos, setDispositivos] = useState<DispositivoSospechoso[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<PeriodRange>(null);

  useEffect(() => {
    fetchDispositivos();
  }, []);

  const fetchDispositivos = async () => {
    setLoading(true);
    try {
      const { data, error } = await api.get<DispositivoSospechoso[]>("/dispositivos-sospechosos.php");
      if (error) throw new Error(error);
      setDispositivos(data || []);
    } catch (error) {
      console.error("Error fetching suspicious devices:", error);
      toast.error("Error al cargar los dispositivos sospechosos");
    } finally {
      setLoading(false);
    }
  };

  const availableDates = useMemo(
    () => dispositivos.flatMap((d) => d.registros.map((r) => new Date(r.fecha_creacion))),
    [dispositivos],
  );

  const dispositivosFiltrados = useMemo(() => {
    if (!range) return dispositivos;
    return dispositivos
      .map((d) => ({
        ...d,
        registros: d.registros.filter((r) => isWithinRange(new Date(r.fecha_creacion), range)),
      }))
      .filter((d) => d.registros.length > 0);
  }, [dispositivos, range]);

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Cargando...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          Dispositivos Sospechosos
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Dispositivos con más de 2 encuestas registradas en los últimos 7 días. Esto no bloquea nada
          automáticamente — es para revisión manual del equipo.
        </p>
        <div className="pt-2">
          <PeriodFilter dates={availableDates} onChange={setRange} label="Filtrar registros por período" />
        </div>
      </CardHeader>
      <CardContent>
        {dispositivosFiltrados.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {range ? "No hay registros sospechosos en el período seleccionado." : "No hay dispositivos sospechosos por ahora."}
          </p>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {dispositivosFiltrados.map((d) => (
              <AccordionItem key={d.device_id} value={d.device_id}>
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs">{d.device_id.slice(0, 8)}...</span>
                    <Badge variant="destructive">{d.registros.length} registros</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {d.registros.map((r) => (
                      <div key={r.id} className="text-xs border-l-2 border-amber-400 pl-3 py-1">
                        <p className="text-muted-foreground">
                          {new Date(r.fecha_creacion).toLocaleString("es-EC")} · IP: {r.ip_address ?? "—"}
                        </p>
                        {r.comentario && <p>{r.comentario}</p>}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

export default SuspiciousDevicesTab;
