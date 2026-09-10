import { useState, useEffect } from "react";
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
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Link2, MessageCircle, QrCode, Copy } from "lucide-react";

type Enlace = {
  codigo: string;
  creado_en: string;
  usado_en: string | null;
};

const PAISES = [
  { code: "593", flag: "🇪🇨", name: "Ecuador" },
  { code: "57", flag: "🇨🇴", name: "Colombia" },
  { code: "51", flag: "🇵🇪", name: "Perú" },
  { code: "1", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "34", flag: "🇪🇸", name: "España" },
  { code: "52", flag: "🇲🇽", name: "México" },
  { code: "56", flag: "🇨🇱", name: "Chile" },
  { code: "54", flag: "🇦🇷", name: "Argentina" },
  { code: "58", flag: "🇻🇪", name: "Venezuela" },
  { code: "591", flag: "🇧🇴", name: "Bolivia" },
  { code: "595", flag: "🇵🇾", name: "Paraguay" },
  { code: "598", flag: "🇺🇾", name: "Uruguay" },
  { code: "506", flag: "🇨🇷", name: "Costa Rica" },
  { code: "507", flag: "🇵🇦", name: "Panamá" },
  { code: "502", flag: "🇬🇹", name: "Guatemala" },
  { code: "503", flag: "🇸🇻", name: "El Salvador" },
  { code: "504", flag: "🇭🇳", name: "Honduras" },
  { code: "505", flag: "🇳🇮", name: "Nicaragua" },
];

// En producción es "" (sin prefijo); en un deploy de staging bajo una
// subcarpeta (ej. /alpha/) se define VITE_BASE_PATH para que los enlaces
// generados incluyan ese prefijo también.
const BASE_PATH = (import.meta.env.VITE_BASE_PATH as string | undefined) || "";

const GenerateLinkTab = () => {
  const [enlaces, setEnlaces] = useState<Enlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [nuevoEnlace, setNuevoEnlace] = useState<{ codigo: string; url: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [nombrePaciente, setNombrePaciente] = useState("");
  const [paisCodigo, setPaisCodigo] = useState("593");
  const [telefono, setTelefono] = useState("");

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

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await api.post<{ codigo: string; url: string }>("/enlaces.php", {});
      if (error || !data) throw new Error(error ?? "Error desconocido");
      const urlCompleta = `${window.location.origin}${BASE_PATH}${data.url}`;
      const qr = await QRCode.toDataURL(urlCompleta);
      setNuevoEnlace({ codigo: data.codigo, url: urlCompleta });
      setQrDataUrl(qr);
      fetchEnlaces();
    } catch (error) {
      console.error("Error generating link:", error);
      toast.error("Error al generar el enlace");
    } finally {
      setGenerating(false);
    }
  };

  const saludo = nombrePaciente.trim() ? `Hola ${nombrePaciente.trim()}` : "Hola";
  const mensajeWhatsapp = nuevoEnlace
    ? `${saludo}, gracias por tu visita a IMV Health Digestive. Nos ayudaría mucho que respondas esta breve encuesta de satisfacción: ${nuevoEnlace.url}`
    : "";
  const numeroLimpio = telefono.replace(/[^0-9]/g, "");
  const numeroCompleto = numeroLimpio ? `${paisCodigo}${numeroLimpio}` : "";
  const whatsappHref = `https://wa.me/${numeroCompleto}?text=${encodeURIComponent(mensajeWhatsapp)}`;

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
            Genera un enlace único al finalizar cada visita y envíalo por WhatsApp. Una vez respondido,
            el enlace queda invalidado automáticamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Generando..." : "Generar nuevo enlace"}
          </Button>

          {nuevoEnlace && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex flex-col items-center gap-2">
                {qrDataUrl && <img src={qrDataUrl} alt="Código QR del enlace" className="w-40 h-40" />}
                <p className="text-xs font-mono break-all text-center">{nuevoEnlace.url}</p>
              </div>

              <Input
                placeholder="Nombre del paciente (opcional)"
                value={nombrePaciente}
                onChange={(e) => setNombrePaciente(e.target.value)}
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={paisCodigo} onValueChange={setPaisCodigo}>
                  <SelectTrigger className="sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAISES.map((p) => (
                      <SelectItem key={`${p.code}-${p.name}`} value={p.code}>
                        {p.flag} +{p.code} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Número del paciente (sin el código de país)"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
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
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : enlaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no se han generado enlaces.</p>
          ) : (
            <div className="space-y-2">
              {enlaces.map((e) => (
                <div key={e.codigo} className="flex items-center justify-between text-sm border-b pb-2">
                  <span className="font-mono">{e.codigo}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(e.creado_en).toLocaleString("es-EC")}
                  </span>
                  {e.usado_en ? (
                    <Badge variant="secondary">Usado</Badge>
                  ) : (
                    <Badge variant="outline">Sin usar</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GenerateLinkTab;
