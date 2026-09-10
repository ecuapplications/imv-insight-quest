import { useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Link2, MessageCircle, QrCode, Copy, CheckCircle2, MessageSquarePlus } from "lucide-react";
import PeriodFilter from "./PeriodFilter";
import { isWithinRange, type PeriodRange } from "@/lib/dateFilter";
import {
  EC, CO, PE, US, ES, MX, CL, AR, VE, BO, PY, UY, CR, PA, GT, SV, HN, NI,
} from "country-flag-icons/react/3x2";

type Visita = {
  device_id: string | null;
  ip_address: string | null;
  visitado_en: string;
  respondido: boolean;
};

type ComentarioAdicional = {
  comentario: string;
  creado_en: string;
};

type Enlace = {
  codigo: string;
  nombre_paciente: string | null;
  apellido_paciente: string | null;
  telefono: string | null;
  creado_en: string;
  usado_en: string | null;
  visitas: Visita[];
  comentarios_adicionales: ComentarioAdicional[];
};

const PAISES = [
  { code: "593", Flag: EC, name: "Ecuador" },
  { code: "57", Flag: CO, name: "Colombia" },
  { code: "51", Flag: PE, name: "Perú" },
  { code: "1", Flag: US, name: "Estados Unidos" },
  { code: "34", Flag: ES, name: "España" },
  { code: "52", Flag: MX, name: "México" },
  { code: "56", Flag: CL, name: "Chile" },
  { code: "54", Flag: AR, name: "Argentina" },
  { code: "58", Flag: VE, name: "Venezuela" },
  { code: "591", Flag: BO, name: "Bolivia" },
  { code: "595", Flag: PY, name: "Paraguay" },
  { code: "598", Flag: UY, name: "Uruguay" },
  { code: "506", Flag: CR, name: "Costa Rica" },
  { code: "507", Flag: PA, name: "Panamá" },
  { code: "502", Flag: GT, name: "Guatemala" },
  { code: "503", Flag: SV, name: "El Salvador" },
  { code: "504", Flag: HN, name: "Honduras" },
  { code: "505", Flag: NI, name: "Nicaragua" },
];

// En producción es "" (sin prefijo); en un deploy de staging bajo una
// subcarpeta (ej. /alpha/) se define VITE_BASE_PATH para que los enlaces
// generados incluyan ese prefijo también.
const BASE_PATH = (import.meta.env.VITE_BASE_PATH as string | undefined) || "";

const GenerateLinkTab = () => {
  const [enlaces, setEnlaces] = useState<Enlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [nuevoEnlace, setNuevoEnlace] = useState<{ codigo: string; url: string; nombre: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [nombrePaciente, setNombrePaciente] = useState("");
  const [apellidoPaciente, setApellidoPaciente] = useState("");
  const [paisCodigo, setPaisCodigo] = useState("593");
  const [telefono, setTelefono] = useState("");
  const [range, setRange] = useState<PeriodRange>(null);

  useEffect(() => {
    fetchEnlaces();
  }, []);

  const fetchEnlaces = async () => {
    setLoading(true);
    try {
      const { data, error } = await api.get<Enlace[]>("/enlaces.php");
      if (error) throw new Error(error);
      setEnlaces(data || []);
    } catch (error) {
      console.error("Error fetching links:", error);
      toast.error("Error al cargar los enlaces");
    } finally {
      setLoading(false);
    }
  };

  const availableDates = useMemo(() => enlaces.map((e) => new Date(e.creado_en)), [enlaces]);
  const enlacesFiltrados = useMemo(
    () => enlaces.filter((e) => isWithinRange(new Date(e.creado_en), range)),
    [enlaces, range],
  );

  const numeroLimpio = telefono.replace(/[^0-9]/g, "");
  const puedeGenerar =
    nombrePaciente.trim() !== "" && apellidoPaciente.trim() !== "" && numeroLimpio !== "";

  const handleGenerate = async () => {
    if (!puedeGenerar) {
      toast.error("El nombre, el apellido y el número de WhatsApp del paciente son obligatorios");
      return;
    }
    setGenerating(true);
    try {
      const numeroCompleto = `${paisCodigo}${numeroLimpio}`;
      const { data, error } = await api.post<{ codigo: string; url: string }>("/enlaces.php", {
        nombre_paciente: nombrePaciente.trim(),
        apellido_paciente: apellidoPaciente.trim(),
        telefono: numeroCompleto,
      });
      if (error || !data) throw new Error(error ?? "Error desconocido");
      const urlCompleta = `${window.location.origin}${BASE_PATH}${data.url}`;
      const qr = await QRCode.toDataURL(urlCompleta);
      setNuevoEnlace({ codigo: data.codigo, url: urlCompleta, nombre: nombrePaciente.trim() });
      setQrDataUrl(qr);
      setNombrePaciente("");
      setApellidoPaciente("");
      setTelefono("");
      fetchEnlaces();
    } catch (error) {
      console.error("Error generating link:", error);
      toast.error("Error al generar el enlace");
    } finally {
      setGenerating(false);
    }
  };

  const mensajeWhatsapp = nuevoEnlace
    ? `Hola ${nuevoEnlace.nombre}, gracias por tu visita a IMV Health Digestive. Nos ayudaría mucho que respondas esta breve encuesta de satisfacción: ${nuevoEnlace.url}`
    : "";
  const whatsappHref = `https://wa.me/${paisCodigo}${numeroLimpio}?text=${encodeURIComponent(mensajeWhatsapp)}`;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(mensajeWhatsapp);
      toast.success("Mensaje copiado al portapapeles");
    } catch (error) {
      console.error("Error copying message:", error);
      toast.error("No se pudo copiar el mensaje");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Generar Enlace de un Solo Uso
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            El nombre y el WhatsApp del paciente son obligatorios — se registran junto con el enlace para
            poder rastrear a quién se le envió y cuándo lo abre.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Nombre del paciente (obligatorio)"
              value={nombrePaciente}
              onChange={(e) => setNombrePaciente(e.target.value)}
            />
            <Input
              placeholder="Apellido del paciente (obligatorio, solo visible para administradores)"
              value={apellidoPaciente}
              onChange={(e) => setApellidoPaciente(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={paisCodigo} onValueChange={setPaisCodigo}>
              <SelectTrigger className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAISES.map((p) => (
                  <SelectItem key={`${p.code}-${p.name}`} value={p.code}>
                    <span className="flex items-center gap-2">
                      <p.Flag className="h-3.5 w-5 shrink-0 rounded-sm" title={p.name} />
                      +{p.code} {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Número de WhatsApp del paciente (obligatorio, sin el código de país)"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>

          <Button onClick={handleGenerate} disabled={generating || !puedeGenerar}>
            {generating ? "Generando..." : "Generar nuevo enlace"}
          </Button>

          {nuevoEnlace && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex flex-col items-center gap-2">
                {qrDataUrl && <img src={qrDataUrl} alt="Código QR del enlace" className="w-40 h-40" />}
                <p className="text-xs font-mono break-all text-center">{nuevoEnlace.url}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                  <Button className="bg-green-600 hover:bg-green-700 text-white w-full">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Enviar por WhatsApp
                  </Button>
                </a>
                <Button variant="outline" onClick={handleCopyMessage} className="w-full sm:w-auto">
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar mensaje
                </Button>
              </div>

              <p className="text-xs text-muted-foreground whitespace-pre-wrap border-t pt-2">
                {mensajeWhatsapp}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode className="h-4 w-4" />
            Últimos enlaces generados
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Expande un enlace para ver el registro de aperturas: dispositivo e IP desde donde se abrió.
          </p>
          <div className="pt-2">
            <PeriodFilter dates={availableDates} onChange={setRange} label="Filtrar enlaces por período" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : enlacesFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {range ? "No hay enlaces generados en el período seleccionado." : "Aún no se han generado enlaces."}
            </p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {enlacesFiltrados.map((e) => (
                <AccordionItem key={e.codigo} value={e.codigo}>
                  <AccordionTrigger className="text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-left">
                      <span className="font-medium">
                        {e.nombre_paciente
                          ? `${e.nombre_paciente} ${e.apellido_paciente ?? ""}`.trim()
                          : "(sin nombre)"}
                      </span>
                      <span className="text-muted-foreground text-xs">{e.telefono ?? "—"}</span>
                      <span className="text-muted-foreground text-xs font-mono">{e.codigo}</span>
                      {e.usado_en ? (
                        <Badge variant="secondary">Respondido</Badge>
                      ) : (
                        <Badge variant="outline">Sin responder</Badge>
                      )}
                      <Badge variant="outline">{e.visitas.length} apertura{e.visitas.length === 1 ? "" : "s"}</Badge>
                      {e.comentarios_adicionales.length > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <MessageSquarePlus className="h-3 w-3" />
                          {e.comentarios_adicionales.length} comentario{e.comentarios_adicionales.length === 1 ? "" : "s"} adicional{e.comentarios_adicionales.length === 1 ? "" : "es"}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground mb-2">
                      Generado: {new Date(e.creado_en).toLocaleString("es-EC")}
                      {e.usado_en && ` · Respondido: ${new Date(e.usado_en).toLocaleString("es-EC")}`}
                    </p>
                    {e.visitas.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aún no se ha abierto.</p>
                    ) : (
                      <div className="space-y-1">
                        {e.visitas.map((v, i) => (
                          <div
                            key={i}
                            className={`text-xs border-l-2 pl-3 py-1 flex items-center gap-1.5 ${
                              v.respondido ? "border-green-500" : "border-cyan-400"
                            }`}
                          >
                            {v.respondido && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            )}
                            <span>
                              {new Date(v.visitado_en).toLocaleString("es-EC")} · IP: {v.ip_address ?? "—"} ·
                              Dispositivo: {v.device_id ? `${v.device_id.slice(0, 8)}...` : "—"}
                              {v.respondido && " · Esta apertura generó la respuesta"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {e.comentarios_adicionales.length > 0 && (
                      <div className="mt-3 pt-2 border-t space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <MessageSquarePlus className="h-3.5 w-3.5" /> Comentarios adicionales
                        </p>
                        {e.comentarios_adicionales.map((c, i) => (
                          <div key={i} className="text-xs bg-muted/40 rounded p-2">
                            <p className="text-muted-foreground">
                              {new Date(c.creado_en).toLocaleString("es-EC")}
                            </p>
                            <p className="whitespace-pre-wrap">{c.comentario}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GenerateLinkTab;
