<?php
require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$codigo = $body['codigo'] ?? null;
$deviceId = $body['device_id'] ?? null;
$ip = $_SERVER['REMOTE_ADDR'] ?? null;

if (!$codigo) {
    json_error('Falta el código', 400);
}

$db = get_db();
$stmt = $db->prepare('SELECT id, nombre_paciente FROM enlaces_encuesta WHERE codigo = :codigo');
$stmt->execute(['codigo' => $codigo]);
$enlace = $stmt->fetch();

if ($enlace) {
    $db->prepare(
        'INSERT INTO enlace_visitas (enlace_id, device_id, ip_address) VALUES (:enlace_id, :device_id, :ip)'
    )->execute(['enlace_id' => $enlace['id'], 'device_id' => $deviceId, 'ip' => $ip]);

    enqueue_push_notification($db, 'apertura_enlace', [
        'title' => 'Enlace abierto',
        'body' => ($enlace['nombre_paciente'] ?: 'Un paciente') . ' abrió su enlace de encuesta',
        'url' => '?tab=enlaces',
    ]);
}

json_ok(['logged' => true]);
