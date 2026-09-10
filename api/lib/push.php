<?php
// Encola una notificación push para que la procese el script disparado por
// cron (api/scripts/procesar_notificaciones_push.php) — nunca se envía de
// forma síncrona aquí, para no agregarle latencia a las requests públicas.
function enqueue_push_notification(PDO $db, string $tipo, array $payload): void {
    $db->prepare('INSERT INTO push_notificaciones_pendientes (tipo, payload) VALUES (:tipo, :payload)')
       ->execute(['tipo' => $tipo, 'payload' => json_encode($payload)]);
}
