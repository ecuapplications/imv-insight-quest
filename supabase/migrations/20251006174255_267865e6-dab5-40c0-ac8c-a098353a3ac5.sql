-- Create encuestas table for survey responses
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
  etiquetas TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Enable Row Level Security
ALTER TABLE public.encuestas ENABLE ROW LEVEL SECURITY;

-- Policy for public to insert survey responses
CREATE POLICY "Allow public insert on encuestas"
ON public.encuestas
FOR INSERT
TO public
WITH CHECK (true);

-- Policy for authenticated users to read all responses (admin)
CREATE POLICY "Allow authenticated read on encuestas"
ON public.encuestas
FOR SELECT
TO authenticated
USING (true);

-- Policy for authenticated users to update responses (admin)
CREATE POLICY "Allow authenticated update on encuestas"
ON public.encuestas
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_encuestas_fecha_creacion ON public.encuestas(fecha_creacion DESC);
CREATE INDEX idx_encuestas_estado_kanban ON public.encuestas(estado_kanban);
CREATE INDEX idx_encuestas_etiquetas ON public.encuestas USING GIN(etiquetas);