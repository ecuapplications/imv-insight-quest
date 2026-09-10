import { useState, useEffect } from "react";
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
      </CardHeader>
      <CardContent>
        {dispositivos.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay dispositivos sospechosos por ahora.</p>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {dispositivos.map((d) => (
              <AccordionItem key={d.device_id} value={d.device_id}>
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs">{d.device_id.slice(0, 8)}...</span>
                    <Badge variant="destructive">{d.total} registros en 7 días</Badge>
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
