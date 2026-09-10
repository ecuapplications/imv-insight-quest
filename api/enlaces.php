<?php
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();

// Consulta pública de un solo código — usada por la encuesta (/s/:codigo) para
// saludar al paciente por su nombre y saber si ya fue respondido. No requiere
// auth, y solo expone el nombre (nunca el apellido ni el teléfono).
if ($method === 'GET' && !empty($_GET['codigo'])) {
    $stmt = $db->prepare('SELECT nombre_paciente, usado_en FROM enlaces_encuesta WHERE codigo = :codigo');
    $stmt->execute(['codigo' => $_GET['codigo']]);
    $enlace = $stmt->fetch();
    json_ok($enlace ? [
        'nombre_paciente' => $enlace['nombre_paciente'],
        'usado' => $enlace['usado_en'] !== null,
    ] : null);
}

require_auth();

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $nombre = trim($body['nombre_paciente'] ?? '');
    $apellido = trim($body['apellido_paciente'] ?? '');
    $telefono = trim($body['telefono'] ?? '');
    if ($nombre === '' || $apellido === '' || $telefono === '') {
        json_error('El nombre, el apellido y el teléfono del paciente son requeridos', 400);
    }

    $codigo = bin2hex(random_bytes(5));
    $stmt = $db->prepare(
        'INSERT INTO enlaces_encuesta (codigo, nombre_paciente, apellido_paciente, telefono)
         VALUES (:codigo, :nombre, :apellido, :telefono)'
    );
    $stmt->execute(['codigo' => $codigo, 'nombre' => $nombre, 'apellido' => $apellido, 'telefono' => $telefono]);
    json_ok(['codigo' => $codigo, 'url' => '/s/' . $codigo]);
}

if ($method === 'GET') {
    $stmt = $db->query(
        "SELECT e.codigo, e.nombre_paciente, e.apellido_paciente, e.telefono, e.creado_en, e.usado_en,
                COALESCE(
                  (SELECT json_agg(json_build_object(
                            'device_id', v.device_id,
                            'ip_address', v.ip_address,
                            'visitado_en', v.visitado_en,
                            'respondido', v.respondido
                          ) ORDER BY v.visitado_en DESC)
                   FROM enlace_visitas v WHERE v.enlace_id = e.id),
                  '[]'
                ) AS visitas,
                COALESCE(
                  (SELECT json_agg(json_build_object(
                            'comentario', c.comentario,
                            'creado_en', c.creado_en
                          ) ORDER BY c.creado_en DESC)
                   FROM enlace_comentarios_adicionales c WHERE c.enlace_id = e.id),
                  '[]'
                ) AS comentarios_adicionales
         FROM enlaces_encuesta e
         ORDER BY e.creado_en DESC LIMIT 50"
    );
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['visitas'] = json_decode($row['visitas'], true);
        $row['comentarios_adicionales'] = json_decode($row['comentarios_adicionales'], true);
    }
    unset($row);
    json_ok($rows);
}

json_error('Método no permitido', 405);
