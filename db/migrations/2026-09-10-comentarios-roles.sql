-- Agrega apellido del paciente a los enlaces, marca qué apertura resultó en
-- una respuesta, agrega comentarios adicionales post-respuesta, y agrega
-- roles de administrador (admin / recepcion).

ALTER TABLE public.enlaces_encuesta
  ADD COLUMN apellido_paciente TEXT;

ALTER TABLE public.enlace_visitas
  ADD COLUMN respondido BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE public.enlace_comentarios_adicionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enlace_id UUID NOT NULL REFERENCES public.enlaces_encuesta(id) ON DELETE CASCADE,
  comentario TEXT NOT NULL,
  device_id UUID,
  ip_address INET,
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_enlace_comentarios_enlace_id ON public.enlace_comentarios_adicionales(enlace_id);

ALTER TABLE public.admins
  ADD COLUMN role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'recepcion'));
