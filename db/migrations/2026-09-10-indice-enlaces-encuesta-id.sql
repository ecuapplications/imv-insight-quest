-- Índice de soporte para la alerta de "enlaces respondidos por más de un
-- paciente desde el mismo dispositivo" (JOIN encuestas -> enlaces_encuesta
-- por encuesta_id). No había índice sobre esta columna.

CREATE INDEX idx_enlaces_encuesta_id ON public.enlaces_encuesta(encuesta_id);
