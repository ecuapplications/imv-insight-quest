<?php
require __DIR__ . '/bootstrap.php';
require_auth();

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();

if ($method === 'GET') {
    $stmt = $db->query('SELECT id, nombre, email, created_at FROM responsables ORDER BY nombre');
    json_ok($stmt->fetchAll());
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $nombre = trim($body['nombre'] ?? '');
    $email = trim($body['email'] ?? '');
    if ($nombre === '' || $email === '') json_error('Nombre y email son requeridos', 400);
    try {
        $stmt = $db->prepare(
            'INSERT INTO responsables (nombre, email) VALUES (:nombre, :email)
             RETURNING id, nombre, email, created_at'
        );
        $stmt->execute(['nombre' => $nombre, 'email' => $email]);
        json_ok($stmt->fetch());
    } catch (PDOException $e) {
        json_error('Ya existe un responsable con ese email', 409);
    }
}

json_error('Método no permitido', 405);
