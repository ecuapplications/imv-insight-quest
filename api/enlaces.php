<?php
require __DIR__ . '/bootstrap.php';
require_auth();

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();

if ($method === 'POST') {
    $codigo = bin2hex(random_bytes(5));
    $stmt = $db->prepare('INSERT INTO enlaces_encuesta (codigo) VALUES (:codigo)');
    $stmt->execute(['codigo' => $codigo]);
    json_ok(['codigo' => $codigo, 'url' => '/s/' . $codigo]);
}

if ($method === 'GET') {
    $stmt = $db->query(
        'SELECT codigo, creado_en, usado_en FROM enlaces_encuesta ORDER BY creado_en DESC LIMIT 50'
    );
    json_ok($stmt->fetchAll());
}

json_error('Método no permitido', 405);
