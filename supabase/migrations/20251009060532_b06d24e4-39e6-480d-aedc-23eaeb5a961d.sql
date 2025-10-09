-- Crear tabla de etiquetas
CREATE TABLE public.etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para etiquetas
CREATE POLICY "Cualquiera puede leer etiquetas"
ON public.etiquetas
FOR SELECT
USING (true);

CREATE POLICY "Solo autenticados pueden insertar etiquetas"
ON public.etiquetas
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Solo autenticados pueden eliminar etiquetas"
ON public.etiquetas
FOR DELETE
TO authenticated
USING (true);

-- Insertar etiquetas predefinidas existentes
INSERT INTO public.etiquetas (nombre) VALUES
  ('Atención y Trato'),
  ('Tiempos de Espera'),
  ('Claridad de la Información'),
  ('Procesos y Trámites'),
  ('Instalaciones'),
  ('Resolución de Problemas')
ON CONFLICT (nombre) DO NOTHING;