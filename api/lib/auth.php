<?php
require_once __DIR__ . '/jwt.php';

function json_response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    echo json_encode($data);
    exit;
}

function json_error(string $message, int $status = 400): void {
    json_response(['data' => null, 'error' => $message], $status);
}

function json_ok($data): void {
    json_response(['data' => $data, 'error' => null]);
}

function require_auth(): array {
    $config = require __DIR__ . '/../config.php';
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        json_error('No autenticado', 401);
    }
    $payload = jwt_decode($m[1], $config['jwt_secret']);
    if ($payload === null) {
        json_error('Token inválido o expirado', 401);
    }
    return $payload;
}

// Igual que require_auth(), pero además exige rol 'admin'. El rol 'recepcion'
// solo tiene acceso a la generación/consulta de enlaces (api/enlaces.php).
function require_admin(): array {
    $payload = require_auth();
    if (($payload['role'] ?? 'admin') !== 'admin') {
        json_error('No autorizado', 403);
    }
    return $payload;
}

function apply_cors(): void {
    $config = require __DIR__ . '/../config.php';
    if (!empty($config['cors_origin'])) {
        header('Access-Control-Allow-Origin: ' . $config['cors_origin']);
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    }
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
