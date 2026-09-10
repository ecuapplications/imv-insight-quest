<?php
require __DIR__ . '/bootstrap.php';

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
    $nombrePacienteEnlace = null;
    if ($codigoEnlace) {
        $stmt = $db->prepare('SELECT id, usado_en, nombre_paciente FROM enlaces_encuesta WHERE codigo = :codigo');
        $stmt->execute(['codigo' => $codigoEnlace]);
        $enlace = $stmt->fetch();
        if (!$enlace || $enlace['usado_en'] !== null) {
            json_error('Este enlace ya fue utilizado o no es válido.', 410);
        }
        $enlaceId = $enlace['id'];
        $nombrePacienteEnlace = $enlace['nombre_paciente'];
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

            // Marca cuál apertura específica del enlace resultó en esta respuesta:
            // primero intenta la más reciente del mismo dispositivo, y si no hay
            // coincidencia (device_id ausente o distinto), la apertura más reciente.
            $stmt = $db->prepare(
                'UPDATE enlace_visitas SET respondido = true
                 WHERE id = (
                   SELECT id FROM enlace_visitas
                   WHERE enlace_id = :enlace_id AND device_id = :device_id
                   ORDER BY visitado_en DESC LIMIT 1
                 )'
            );
            $stmt->execute(['enlace_id' => $enlaceId, 'device_id' => $deviceId]);
            if ($stmt->rowCount() === 0) {
                $db->prepare(
                    'UPDATE enlace_visitas SET respondido = true
                     WHERE id = (
                       SELECT id FROM enlace_visitas
                       WHERE enlace_id = :enlace_id
                       ORDER BY visitado_en DESC LIMIT 1
                     )'
                )->execute(['enlace_id' => $enlaceId]);
            }

            enqueue_push_notification($db, 'respuesta_via_enlace', [
                'title' => 'Nueva respuesta recibida',
                'body' => ($nombrePacienteEnlace ?: 'Un paciente') . ' respondió la encuesta',
                'url' => '?tab=comentarios',
            ]);

            // "Enlaces de varios pacientes desde un mismo dispositivo": si este
            // dispositivo acaba de responder el enlace de un SEGUNDO paciente
            // distinto (mismo criterio que dispositivos-sospechosos.php), es la
            // primera vez que cruza el umbral — se notifica solo esta vez.
            if ($deviceId) {
                $stmt = $db->prepare(
                    'SELECT count(DISTINCT el.id) FROM encuestas en
                     JOIN enlaces_encuesta el ON el.encuesta_id = en.id
                     WHERE en.device_id = :device_id'
                );
                $stmt->execute(['device_id' => $deviceId]);
                if ((int) $stmt->fetchColumn() === 2) {
                    enqueue_push_notification($db, 'enlace_multi_paciente', [
                        'title' => 'Alerta: mismo dispositivo, varios pacientes',
                        'body' => 'Un dispositivo respondió los enlaces de más de un paciente',
                        'url' => '?tab=sospechosos',
                    ]);
                }
            }
        } else {
            enqueue_push_notification($db, 'respuesta_anonima', [
                'title' => 'Nueva respuesta recibida',
                'body' => 'Se recibió una nueva respuesta a la encuesta',
                'url' => '?tab=comentarios',
            ]);
        }

        // "Dispositivo sospechoso" (mismo criterio que dispositivos-sospechosos.php:
        // más de 2 encuestas en 7 días): si esta es la fila que hace que el conteo
        // pase de 2 a 3, es la primera vez que cruza el umbral.
        if ($deviceId) {
            $stmt = $db->prepare(
                "SELECT count(*) FROM encuestas WHERE device_id = :device_id AND fecha_creacion >= now() - interval '7 days'"
            );
            $stmt->execute(['device_id' => $deviceId]);
            if ((int) $stmt->fetchColumn() === 3) {
                enqueue_push_notification($db, 'dispositivo_sospechoso', [
                    'title' => 'Dispositivo sospechoso',
                    'body' => 'Un dispositivo superó el límite de encuestas en 7 días',
                    'url' => '?tab=sospechosos',
                ]);
            }
        }

        json_ok(['id' => $nuevaEncuestaId]);
    } catch (PDOException $e) {
        json_error('Alguna de las respuestas no tiene un valor válido', 400);
    }
}

require_admin();

if ($method === 'GET') {
    $sql = 'SELECT en.id, en.fecha_creacion, en.pregunta1_amabilidad, en.pregunta2_tiempo_espera, en.pregunta3_resolucion_dudas, en.pregunta4_limpieza, en.pregunta5_calificacion_general, en.comentario, en.estado_kanban, en.etiquetas, en.notas_internas,
                  el.nombre_paciente, el.apellido_paciente, el.telefono
             FROM encuestas en
             LEFT JOIN enlaces_encuesta el ON el.encuesta_id = en.id';
    $conditions = [];
    $params = [];
    if (!empty($_GET['since'])) {
        $conditions[] = 'en.fecha_creacion >= :since';
        $params['since'] = $_GET['since'];
    }
    if (!empty($_GET['with_comment'])) {
        $conditions[] = 'en.comentario IS NOT NULL';
    }
    if ($conditions) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }
    $sql .= ' ORDER BY en.fecha_creacion DESC';
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
