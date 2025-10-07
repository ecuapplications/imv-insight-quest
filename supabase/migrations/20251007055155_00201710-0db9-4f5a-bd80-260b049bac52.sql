-- Crear función para actualizar updated_at si no existe
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Crear tabla de responsables
CREATE TABLE public.responsables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear enum para el estado de las tareas
CREATE TYPE public.estado_tarea AS ENUM ('Pendiente', 'Vencida', 'Descartada', 'Resuelta');

-- Crear tabla de tareas
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

-- Habilitar RLS en responsables
ALTER TABLE public.responsables ENABLE ROW LEVEL SECURITY;

-- Políticas para responsables
CREATE POLICY "Allow authenticated read on responsables"
ON public.responsables
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert on responsables"
ON public.responsables
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Habilitar RLS en tareas
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

-- Políticas para tareas
CREATE POLICY "Allow authenticated read on tareas"
ON public.tareas
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert on tareas"
ON public.tareas
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on tareas"
ON public.tareas
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on tareas"
ON public.tareas
FOR DELETE
TO authenticated
USING (true);

-- Trigger para actualizar updated_at en tareas
CREATE TRIGGER update_tareas_updated_at
BEFORE UPDATE ON public.tareas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_tareas_encuesta_id ON public.tareas(encuesta_id);
CREATE INDEX idx_tareas_responsable_id ON public.tareas(responsable_id);
CREATE INDEX idx_tareas_estado ON public.tareas(estado);