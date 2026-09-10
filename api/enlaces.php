<?php
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();

// Consulta pública de un solo código — usada por la encuesta (/s/:codigo) para
// saludar al paciente por su nombre. No requiere auth, y solo expone el
// nombre, nunca el teléfono ni el listado completo.
if ($method === 'GET' && !empty($_GET['codigo'])) {
    $stmt = $db->prepare('SELECT nombre_paciente FROM enlaces_encuesta WHERE codigo = :codigo');
    $stmt->execute(['codigo' => $_GET['codigo']]);
    $enlace = $stmt->fetch();
    json_ok($enlace ? ['nombre_paciente' => $enlace['nombre_paciente']] : null);
}

require_auth();

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $nombre = trim($body['nombre_paciente'] ?? '');
    $telefono = trim($body['telefono'] ?? '');
    if ($nombre === '' || $telefono === '') {
        json_error('El nombre y el teléfono del paciente son requeridos', 400);
    }

    $codigo = bin2hex(random_bytes(5));
    $stmt = $db->prepare(
        'INSERT INTO enlaces_encuesta (codigo, nombre_paciente, telefono) VALUES (:codigo, :nombre, :telefono)'
    );
    $stmt->execute(['codigo' => $codigo, 'nombre' => $nombre, 'telefono' => $telefono]);
    json_ok(['codigo' => $codigo, 'url' => '/s/' . $codigo]);
}

if ($method === 'GET') {
    $stmt = $db->query(
        "SELECT e.codigo, e.nombre_paciente, e.telefono, e.creado_en, e.usado_en,
                COALESCE(
                  (SELECT json_agg(json_build_object(
                            'device_id', v.device_id,
                            'ip_address', v.ip_address,
                            'visitado_en', v.visitado_en
                          ) ORDER BY v.visitado_en DESC)
                   FROM enlace_visitas v WHERE v.enlace_id = e.id),
                  '[]'
                ) AS visitas
         FROM enlaces_encuesta e
         ORDER BY e.creado_en DESC LIMIT 50"
    );
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['visitas'] = json_decode($row['visitas'], true);
    }
    unset($row);
    json_ok($rows);
}

json_error('Método no permitido', 405);
