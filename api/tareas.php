<?php
require __DIR__ . '/bootstrap.php';
require_auth();

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();

if ($method === 'GET') {
    $encuestaId = $_GET['encuesta_id'] ?? null;
    if (!$encuestaId) json_error('Falta el parámetro encuesta_id', 400);

    $stmt = $db->prepare(
        'SELECT t.*, r.nombre AS responsable_nombre
         FROM tareas t
         LEFT JOIN responsables r ON r.id = t.responsable_id
         WHERE t.encuesta_id = :encuesta_id
         ORDER BY t.created_at ASC'
    );
    $stmt->execute(['encuesta_id' => $encuestaId]);
    $tareas = $stmt->fetchAll();

    $hoy = (new DateTime('today'))->format('Y-m-d');
    foreach ($tareas as &$tarea) {
        if ($tarea['estado'] === 'Pendiente' && $tarea['fecha_vencimiento'] < $hoy) {
            $db->prepare('UPDATE tareas SET estado = :estado WHERE id = :id')
               ->execute(['estado' => 'Vencida', 'id' => $tarea['id']]);
            $tarea['estado'] = 'Vencida';
        }
    }
    unset($tarea);
    json_ok($tareas);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    foreach (['encuesta_id', 'nombre', 'responsable_id', 'fecha_vencimiento'] as $field) {
        if (empty($body[$field])) json_error("El campo $field es requerido", 400);
    }
    try {
        $stmt = $db->prepare(
            'INSERT INTO tareas (encuesta_id, nombre, descripcion, responsable_id, fecha_vencimiento, estado)
             VALUES (:encuesta_id, :nombre, :descripcion, :responsable_id, :fecha_vencimiento, :estado)
             RETURNING id'
        );
        $stmt->execute([
            'encuesta_id' => $body['encuesta_id'],
            'nombre' => $body['nombre'],
            'descripcion' => $body['descripcion'] ?? null,
            'responsable_id' => $body['responsable_id'],
            'fecha_vencimiento' => $body['fecha_vencimiento'],
            'estado' => $body['estado'] ?? 'Pendiente',
        ]);
        json_ok(['id' => $stmt->fetchColumn()]);
    } catch (PDOException $e) {
        json_error('No se pudo crear la tarea (revisa encuesta_id/responsable_id)', 400);
    }
}

if ($method === 'PATCH') {
    $id = $_GET['id'] ?? null;
    if (!$id) json_error('Falta el parámetro id', 400);
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $allowed = ['nombre', 'descripcion', 'responsable_id', 'fecha_vencimiento', 'estado'];
    $sets = [];
    $params = ['id' => $id];
    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $sets[] = "$field = :$field";
            $params[$field] = $body[$field];
        }
    }
    if (!$sets) json_error('No hay campos para actualizar', 400);
    try {
        $db->prepare('UPDATE tareas SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
        json_ok(['updated' => true]);
    } catch (PDOException $e) {
        json_error('No se pudo actualizar la tarea', 400);
    }
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) json_error('Falta el parámetro id', 400);
    $db->prepare('DELETE FROM tareas WHERE id = :id')->execute(['id' => $id]);
    json_ok(['deleted' => true]);
}

json_error('Método no permitido', 405);
