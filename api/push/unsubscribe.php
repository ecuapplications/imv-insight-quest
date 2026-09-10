<?php
require __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$payload = require_auth();
$adminId = $payload['sub'];

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$endpoint = trim($body['endpoint'] ?? '');

if ($endpoint === '') {
    json_error('Falta el endpoint de la suscripción', 400);
}

$db = get_db();
$stmt = $db->prepare('DELETE FROM push_subscriptions WHERE endpoint = :endpoint AND admin_id = :admin_id');
$stmt->execute(['endpoint' => $endpoint, 'admin_id' => $adminId]);

json_ok(['unsubscribed' => true]);
