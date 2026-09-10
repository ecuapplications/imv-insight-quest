<?php
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    // Honeypot: un bot que autocompleta todo el formulario cae aquí. Se responde
    // como éxito (sin insertar) para no revelar que fue detectado.
    if (!empty($body['sitio_web'])) {
        json_ok(['id' => null]);
    }

    // Tiempo de llenado: nadie contesta 5 preguntas + comentario en menos de 3s.
    $segundos = $body['segundos_transcurridos'] ?? null;
    if ($segundos !== null && $segundos < 3) {
        json_ok(['id' => null]);
    }

    $required = [
        'pregunta1_amabilidad', 'pregunta2_tiempo_espera', 'pregunta3_resolucion_dudas',
        'pregunta4_limpieza', 'pregunta5_calificacion_general',
    ];
    foreach ($required as $field) {
        if (empty($body[$field])) {
            json_error("El campo $field es requerido", 400);
        }
    }
    $comentario = $body['comentario'] ?? null;
    try {
        $stmt = $db->prepare(
            'INSERT INTO encuestas (pregunta1_amabilidad, pregunta2_tiempo_espera, pregunta3_resolucion_dudas, pregunta4_limpieza, pregunta5_calificacion_general, comentario, estado_kanban)
             VALUES (:p1, :p2, :p3, :p4, :p5, :comentario, :estado_kanban)
             RETURNING id'
        );
        $stmt->execute([
            'p1' => $body['pregunta1_amabilidad'],
            'p2' => $body['pregunta2_tiempo_espera'],
            'p3' => $body['pregunta3_resolucion_dudas'],
            'p4' => $body['pregunta4_limpieza'],
            'p5' => $body['pregunta5_calificacion_general'],
            'comentario' => $comentario,
            'estado_kanban' => $comentario ? 'Bandeja de Entrada' : null,
        ]);
        json_ok(['id' => $stmt->fetchColumn()]);
    } catch (PDOException $e) {
        json_error('Alguna de las respuestas no tiene un valor válido', 400);
    }
}

require_auth();

if ($method === 'GET') {
    $sql = 'SELECT id, fecha_creacion, pregunta1_amabilidad, pregunta2_tiempo_espera, pregunta3_resolucion_dudas, pregunta4_limpieza, pregunta5_calificacion_general, comentario, estado_kanban, etiquetas, notas_internas FROM encuestas';
    $conditions = [];
    $params = [];
    if (!empty($_GET['since'])) {
        $conditions[] = 'fecha_creacion >= :since';
        $params['since'] = $_GET['since'];
    }
    if (!empty($_GET['with_comment'])) {
        $conditions[] = 'comentario IS NOT NULL';
    }
    if ($conditions) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }
    $sql .= ' ORDER BY fecha_creacion DESC';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['etiquetas'] = pg_text_array_to_php($row['etiquetas']);
    }
    unset($row);
    json_ok($rows);
}

if ($method === 'PATCH') {
    $id = $_GET['id'] ?? null;
    if (!$id) json_error('Falta el parámetro id', 400);
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $allowed = ['estado_kanban', 'etiquetas', 'notas_internas'];
    $sets = [];
    $params = ['id' => $id];
    foreach ($allowed as $field) {
        if (!array_key_exists($field, $body)) continue;
        $sets[] = "$field = :$field";
        if ($field === 'etiquetas') {
            $escaped = array_map(fn($t) => '"' . str_replace('"', '\\"', $t) . '"', $body[$field]);
            $params[$field] = '{' . implode(',', $escaped) . '}';
        } else {
            $params[$field] = $body[$field];
        }
    }
    if (!$sets) json_error('No hay campos para actualizar', 400);
    $sql = 'UPDATE encuestas SET ' . implode(', ', $sets) . ' WHERE id = :id';
    $db->prepare($sql)->execute($params);
    json_ok(['updated' => true]);
}

json_error('Método no permitido', 405);
