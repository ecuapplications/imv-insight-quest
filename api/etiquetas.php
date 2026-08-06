<?php
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();

if ($method === 'GET') {
    $stmt = $db->query('SELECT id, nombre, created_at FROM etiquetas ORDER BY nombre');
    json_ok($stmt->fetchAll());
}

require_auth();

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $nombre = trim($body['nombre'] ?? '');
    if ($nombre === '') json_error('El nombre es requerido', 400);
    try {
        $stmt = $db->prepare(
            'INSERT INTO etiquetas (nombre) VALUES (:nombre)
             RETURNING id, nombre, created_at'
        );
        $stmt->execute(['nombre' => $nombre]);
        json_ok($stmt->fetch());
    } catch (PDOException $e) {
        json_error('Ya existe una etiqueta con ese nombre', 409);
    }
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) json_error('Falta el parámetro id', 400);
    $db->prepare('DELETE FROM etiquetas WHERE id = :id')->execute(['id' => $id]);
    json_ok(['deleted' => true]);
}

json_error('Método no permitido', 405);
