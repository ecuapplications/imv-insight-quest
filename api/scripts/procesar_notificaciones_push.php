<?php
// CLI, disparado por un Cron Job de SiteGround cada 1 minuto:
//   php /home/USUARIO/public_html/[alpha/]api/scripts/procesar_notificaciones_push.php
//
// Procesa la cola de notificaciones (api/lib/push.php las encola desde los
// endpoints públicos) y envía los pushes correspondientes. Nunca se llama
// desde una request pública directamente — así una apertura de enlace o un
// envío de encuesta nunca esperan a que termine de contactarse el push
// service de cada admin suscrito.

require __DIR__ . '/../lib/db.php';
require __DIR__ . '/../vendor/autoload.php';

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

$config = require __DIR__ . '/../config.php';
$db = get_db();

// Qué roles reciben cada tipo de notificación (ver db/schema.sql para la
// lista completa de tipos válidos).
$ROLES_POR_TIPO = [
    'apertura_enlace' => ['admin', 'recepcion'],
    'respuesta_via_enlace' => ['admin', 'recepcion'],
    'respuesta_anonima' => ['admin'],
    'dispositivo_sospechoso' => ['admin'],
    'enlace_multi_paciente' => ['admin'],
];

$stmt = $db->query(
    'SELECT id, tipo, payload FROM push_notificaciones_pendientes
     WHERE enviado_en IS NULL ORDER BY creado_en LIMIT 200'
);
$pendientes = $stmt->fetchAll();

if (!$pendientes) {
    echo "Nada pendiente.\n";
    exit(0);
}

$webPush = new WebPush([
    'VAPID' => [
        'subject' => $config['vapid']['subject'],
        'publicKey' => $config['vapid']['public_key'],
        'privateKey' => $config['vapid']['private_key'],
    ],
]);

$idsProcesados = [];
$totalEncolados = 0;

foreach ($pendientes as $item) {
    $idsProcesados[] = $item['id'];

    $roles = $ROLES_POR_TIPO[$item['tipo']] ?? [];
    if (!$roles) {
        continue;
    }

    $placeholders = implode(',', array_fill(0, count($roles), '?'));
    $stmtSubs = $db->prepare(
        "SELECT s.endpoint, s.p256dh, s.auth
         FROM push_subscriptions s
         JOIN admins a ON a.id = s.admin_id
         WHERE a.role IN ($placeholders)"
    );
    $stmtSubs->execute($roles);

    // El payload ya viene con la forma exacta que espera el listener `push`
    // del service worker: {title, body, url}.
    foreach ($stmtSubs->fetchAll() as $sub) {
        $subscription = Subscription::create([
            'endpoint' => $sub['endpoint'],
            'keys' => ['p256dh' => $sub['p256dh'], 'auth' => $sub['auth']],
            'contentEncoding' => 'aes128gcm',
        ]);
        $webPush->queueNotification($subscription, $item['payload']);
        $totalEncolados++;
    }
}

$suscripcionesVencidas = 0;
foreach ($webPush->flush() as $report) {
    if (!$report->isSuccess() && $report->isSubscriptionExpired()) {
        $db->prepare('DELETE FROM push_subscriptions WHERE endpoint = :endpoint')
           ->execute(['endpoint' => $report->getEndpoint()]);
        $suscripcionesVencidas++;
    }
}

if ($idsProcesados) {
    $in = implode(',', array_fill(0, count($idsProcesados), '?'));
    $db->prepare("UPDATE push_notificaciones_pendientes SET enviado_en = now() WHERE id IN ($in)")
       ->execute($idsProcesados);
}

// Housekeeping: no dejar crecer la tabla indefinidamente.
$db->exec(
    "DELETE FROM push_notificaciones_pendientes
     WHERE enviado_en IS NOT NULL AND enviado_en < now() - interval '7 days'"
);

echo count($pendientes) . " notificaciones de la cola procesadas, "
    . $totalEncolados . " pushes enviados, "
    . $suscripcionesVencidas . " suscripciones vencidas eliminadas.\n";
