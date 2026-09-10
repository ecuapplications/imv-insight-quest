-- Migración incremental para la base de producción existente (ya tiene datos).
-- No usar db/schema.sql para esto: schema.sql es solo para instalaciones nuevas.

ALTER TABLE public.encuestas
  ADD COLUMN device_id UUID,
  ADD COLUMN ip_address INET;

CREATE INDEX idx_encuestas_device_id ON public.encuestas(device_id);
CREATE INDEX idx_encuestas_device_fecha ON public.encuestas(device_id, fecha_creacion);
CREATE INDEX idx_encuestas_ip_fecha ON public.encuestas(ip_address, fecha_creacion);

CREATE TABLE public.enlaces_encuesta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usado_en TIMESTAMP WITH TIME ZONE,
  encuesta_id UUID REFERENCES public.encuestas(id) ON DELETE SET NULL
);

CREATE INDEX idx_enlaces_codigo ON public.enlaces_encuesta(codigo);
