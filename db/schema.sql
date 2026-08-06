-- Esquema combinado, portado desde supabase/migrations/*.sql
-- (RLS de Supabase se elimina: el control de acceso ahora vive en la capa PHP)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.encuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now(),
  pregunta1_amabilidad TEXT NOT NULL CHECK (pregunta1_amabilidad IN ('Sí', 'No')),
  pregunta2_tiempo_espera TEXT NOT NULL CHECK (pregunta2_tiempo_espera IN ('Menos de 5 minutos', 'Entre 5 y 10 minutos', 'Más de 10 minutos')),
  pregunta3_resolucion_dudas TEXT NOT NULL CHECK (pregunta3_resolucion_dudas IN ('Sí', 'No', 'No tenía')),
  pregunta4_limpieza TEXT NOT NULL CHECK (pregunta4_limpieza IN ('Excelente', 'Buena', 'Regular', 'Mala')),
  pregunta5_calificacion_general TEXT NOT NULL CHECK (pregunta5_calificacion_general IN ('Excelente', 'Buena', 'Regular', 'Mala')),
  comentario TEXT,
  estado_kanban TEXT DEFAULT 'Bandeja de Entrada' CHECK (estado_kanban IN ('Bandeja de Entrada', 'Felicitaciones y Reconocimientos 👍', 'Sugerencias de Mejora 💡', 'Áreas de Oportunidad (Quejas) ⚠️', 'Archivado / Resuelto ✅')),
  etiquetas TEXT[] DEFAULT ARRAY[]::TEXT[],
  notas_internas TEXT
);

CREATE INDEX idx_encuestas_fecha_creacion ON public.encuestas(fecha_creacion DESC);
CREATE INDEX idx_encuestas_estado_kanban ON public.encuestas(estado_kanban);
CREATE INDEX idx_encuestas_etiquetas ON public.encuestas USING GIN(etiquetas);

CREATE TABLE public.responsables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TYPE public.estado_tarea AS ENUM ('Pendiente', 'Vencida', 'Descartada', 'Resuelta');

CREATE TABLE public.tareas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  encuesta_id UUID NOT NULL REFERENCES public.encuestas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  responsable_id UUID NOT NULL REFERENCES public.responsables(id) ON DELETE RESTRICT,
  fecha_vencimiento DATE NOT NULL,
  estado public.estado_tarea NOT NULL DEFAULT 'Pendiente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_tareas_encuesta_id ON public.tareas(encuesta_id);
CREATE INDEX idx_tareas_responsable_id ON public.tareas(responsable_id);
CREATE INDEX idx_tareas_estado ON public.tareas(estado);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tareas_updated_at
BEFORE UPDATE ON public.tareas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.etiquetas (nombre) VALUES
  ('Atención y Trato'),
  ('Tiempos de Espera'),
  ('Claridad de la Información'),
  ('Procesos y Trámites'),
  ('Instalaciones'),
  ('Resolución de Problemas')
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
