import { Inbox, ThumbsUp, Lightbulb, AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";

// Los valores de ESTADOS deben coincidir EXACTAMENTE con el CHECK constraint
// de la columna estado_kanban en Postgres — no quitar los emojis de aquí,
// son parte del dato guardado. Lo que cambia es solo cómo se muestran.
export const ESTADOS = [
  "Bandeja de Entrada",
  "Felicitaciones y Reconocimientos 👍",
  "Sugerencias de Mejora 💡",
  "Áreas de Oportunidad (Quejas) ⚠️",
  "Archivado / Resuelto ✅",
] as const;

const ESTADO_LABELS: Record<string, string> = {
  "Bandeja de Entrada": "Bandeja de Entrada",
  "Felicitaciones y Reconocimientos 👍": "Felicitaciones y Reconocimientos",
  "Sugerencias de Mejora 💡": "Sugerencias de Mejora",
  "Áreas de Oportunidad (Quejas) ⚠️": "Áreas de Oportunidad (Quejas)",
  "Archivado / Resuelto ✅": "Archivado / Resuelto",
};

const ESTADO_ICONOS: Record<string, LucideIcon> = {
  "Bandeja de Entrada": Inbox,
  "Felicitaciones y Reconocimientos 👍": ThumbsUp,
  "Sugerencias de Mejora 💡": Lightbulb,
  "Áreas de Oportunidad (Quejas) ⚠️": AlertTriangle,
  "Archivado / Resuelto ✅": CheckCircle2,
};

export function getEstadoLabel(estado: string): string {
  return ESTADO_LABELS[estado] ?? estado;
}

export function getEstadoIcon(estado: string): LucideIcon {
  return ESTADO_ICONOS[estado] ?? Inbox;
}
