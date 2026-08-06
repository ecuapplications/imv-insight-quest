<?php
require __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$email = trim($body['email'] ?? '');
$password = $body['password'] ?? '';

if ($email === '' || $password === '') {
    json_error('Email y contraseña son requeridos', 400);
}

$stmt = get_db()->prepare('SELECT id, email, password_hash FROM admins WHERE email = :email');
$stmt->execute(['email' => $email]);
$admin = $stmt->fetch();

if (!$admin || !password_verify($password, $admin['password_hash'])) {
    json_error('Credenciales incorrectas', 401);
}

$config = require __DIR__ . '/../config.php';
$token = jwt_encode([
    'sub' => $admin['id'],
    'email' => $admin['email'],
    'exp' => time() + $config['jwt_ttl_seconds'],
], $config['jwt_secret']);

json_ok(['token' => $token, 'email' => $admin['email']]);
