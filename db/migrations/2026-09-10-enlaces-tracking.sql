-- Agrega datos del destinatario a los enlaces de un solo uso, y una tabla
-- de log de aperturas (dispositivo + IP + hora) por enlace.

ALTER TABLE public.enlaces_encuesta
  ADD COLUMN nombre_paciente TEXT,
  ADD COLUMN telefono TEXT;

CREATE TABLE public.enlace_visitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enlace_id UUID NOT NULL REFERENCES public.enlaces_encuesta(id) ON DELETE CASCADE,
  device_id UUID,
  ip_address INET,
  visitado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_enlace_visitas_enlace_id ON public.enlace_visitas(enlace_id);
