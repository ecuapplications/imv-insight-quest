<?php
require __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$payload = require_auth();
$adminId = $payload['sub'];

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$endpoint = trim($body['endpoint'] ?? '');
$p256dh = trim($body['keys']['p256dh'] ?? '');
$auth = trim($body['keys']['auth'] ?? '');

if ($endpoint === '' || $p256dh === '' || $auth === '') {
    json_error('Suscripción push inválida', 400);
}

$db = get_db();
$stmt = $db->prepare(
    'INSERT INTO push_subscriptions (admin_id, endpoint, p256dh, auth)
     VALUES (:admin_id, :endpoint, :p256dh, :auth)
     ON CONFLICT (endpoint) DO UPDATE
       SET admin_id = EXCLUDED.admin_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth'
);
$stmt->execute(['admin_id' => $adminId, 'endpoint' => $endpoint, 'p256dh' => $p256dh, 'auth' => $auth]);

json_ok(['subscribed' => true]);
