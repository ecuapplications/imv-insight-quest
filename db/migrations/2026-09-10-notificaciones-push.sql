-- Tablas para notificaciones push: suscripciones de cada admin/recepcion
-- (una por dispositivo/navegador) y una cola de notificaciones pendientes
-- que un script disparado por cron procesa y envía (nunca de forma síncrona
-- dentro de una request pública de paciente).

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_admin_id ON public.push_subscriptions(admin_id);

CREATE TABLE public.push_notificaciones_pendientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN (
    'apertura_enlace', 'respuesta_via_enlace', 'respuesta_anonima',
    'dispositivo_sospechoso', 'enlace_multi_paciente'
  )),
  payload JSONB NOT NULL,
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  enviado_en TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_push_pendientes_sin_enviar
  ON public.push_notificaciones_pendientes(creado_en) WHERE enviado_en IS NULL;
