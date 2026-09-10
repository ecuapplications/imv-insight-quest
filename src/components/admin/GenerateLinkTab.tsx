import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Link2, MessageCircle, QrCode } from "lucide-react";

type Enlace = {
  codigo: string;
  creado_en: string;
  usado_en: string | null;
};

const GenerateLinkTab = () => {
  const [enlaces, setEnlaces] = useState<Enlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [nuevoEnlace, setNuevoEnlace] = useState<{ codigo: string; url: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
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
      const urlCompleta = `${window.location.origin}${data.url}`;
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

  const mensajeWhatsapp = nuevoEnlace
    ? `Hola, gracias por tu visita a IMV Health Digestive. Nos ayudaría mucho que respondas esta breve encuesta de satisfacción: ${nuevoEnlace.url}`
    : "";
  const numeroLimpio = telefono.replace(/[^0-9]/g, "");
  const whatsappHref = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensajeWhatsapp)}`;

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
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Número del paciente (opcional, con código de país)"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Enviar por WhatsApp
                  </Button>
                </a>
              </div>
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
