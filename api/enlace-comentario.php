<?php
require __DIR__ . '/bootstrap.php';

// Comentario adicional público: cuando un paciente abre un enlace ya
// respondido, se le ofrece dejar un comentario adicional en vez de volver a
// contestar la encuesta. No requiere auth.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$codigo = trim($body['codigo'] ?? '');
$comentario = trim($body['comentario'] ?? '');
$deviceId = $body['device_id'] ?? null;
$ip = $_SERVER['REMOTE_ADDR'] ?? null;

if ($codigo === '' || $comentario === '') {
    json_error('Falta el código o el comentario', 400);
}

$db = get_db();
$stmt = $db->prepare('SELECT id FROM enlaces_encuesta WHERE codigo = :codigo');
$stmt->execute(['codigo' => $codigo]);
$enlace = $stmt->fetch();

if (!$enlace) {
    json_error('Enlace no válido', 404);
}

$db->prepare(
    'INSERT INTO enlace_comentarios_adicionales (enlace_id, comentario, device_id, ip_address)
     VALUES (:enlace_id, :comentario, :device_id, :ip)'
)->execute(['enlace_id' => $enlace['id'], 'comentario' => $comentario, 'device_id' => $deviceId, 'ip' => $ip]);

json_ok(['saved' => true]);
