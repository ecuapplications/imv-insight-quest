<?php
require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/turnstile.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();
$config = require __DIR__ . '/config.php';

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

    $turnstileToken = $body['turnstile_token'] ?? '';
    if (!turnstile_verify($turnstileToken, $config['turnstile_secret'])) {
        json_error('No pudimos verificar que eres una persona real. Intenta de nuevo.', 400);
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
    $deviceId = $body['device_id'] ?? null;
    $ip = $_SERVER['REMOTE_ADDR'] ?? null;
    $codigoEnlace = $body['codigo_enlace'] ?? null;

    $enlaceId = null;
    if ($codigoEnlace) {
        $stmt = $db->prepare('SELECT id, usado_en FROM enlaces_encuesta WHERE codigo = :codigo');
        $stmt->execute(['codigo' => $codigoEnlace]);
        $enlace = $stmt->fetch();
        if (!$enlace || $enlace['usado_en'] !== null) {
            json_error('Este enlace ya fue utilizado o no es válido.', 410);
        }
        $enlaceId = $enlace['id'];
    }

    // Rate limit por IP (siempre aplica, incluso con enlace de un solo uso)
    $stmt = $db->prepare(
        "SELECT count(*) FROM encuestas WHERE ip_address = :ip AND fecha_creacion >= now() - interval '1 hour'"
    );
    $stmt->execute(['ip' => $ip]);
    if ((int) $stmt->fetchColumn() >= $config['rate_limit_ip_por_hora']) {
        json_error('Demasiados envíos desde tu red. Intenta más tarde.', 429);
    }

    // Límite de 1 envío por día por dispositivo, salvo que se use un enlace de un solo uso
    // (el enlace en sí ya garantiza que solo se puede usar una vez)
    if (!$enlaceId && $deviceId) {
        $stmt = $db->prepare(
            'SELECT id FROM encuestas WHERE device_id = :device_id AND fecha_creacion::date = CURRENT_DATE LIMIT 1'
        );
        $stmt->execute(['device_id' => $deviceId]);
        if ($stmt->fetch()) {
            json_error('Ya registraste tu encuesta hoy. ¡Gracias por tu participación!', 429);
        }
    }

    try {
        $stmt = $db->prepare(
            'INSERT INTO encuestas (pregunta1_amabilidad, pregunta2_tiempo_espera, pregunta3_resolucion_dudas, pregunta4_limpieza, pregunta5_calificacion_general, comentario, estado_kanban, device_id, ip_address)
             VALUES (:p1, :p2, :p3, :p4, :p5, :comentario, :estado_kanban, :device_id, :ip)
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
            'device_id' => $deviceId,
            'ip' => $ip,
        ]);
        $nuevaEncuestaId = $stmt->fetchColumn();

        if ($enlaceId) {
            $db->prepare('UPDATE enlaces_encuesta SET usado_en = now(), encuesta_id = :encuesta_id WHERE id = :id')
               ->execute(['encuesta_id' => $nuevaEncuestaId, 'id' => $enlaceId]);
        }

        json_ok(['id' => $nuevaEncuestaId]);
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
