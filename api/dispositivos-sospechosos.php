<?php
require __DIR__ . '/bootstrap.php';
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('Método no permitido', 405);
}

$db = get_db();

$stmt = $db->query(
    "SELECT device_id, count(*) AS total,
            json_agg(json_build_object('id', id, 'fecha_creacion', fecha_creacion,
                                        'ip_address', ip_address, 'comentario', comentario)
                      ORDER BY fecha_creacion DESC) AS registros
     FROM encuestas
     WHERE device_id IS NOT NULL
       AND fecha_creacion >= now() - interval '7 days'
     GROUP BY device_id
     HAVING count(*) > 2
     ORDER BY total DESC"
);
$rows = $stmt->fetchAll();
foreach ($rows as &$row) {
    $row['registros'] = json_decode($row['registros'], true);
    $row['total'] = (int) $row['total'];
}
unset($row);

// Un mismo dispositivo respondiendo el enlace de más de un paciente distinto
// es una señal fuerte de que alguien está completando encuestas por otros
// (o reutilizando su propio celular para varios pacientes).
//
// Envuelto en try/catch: esta consulta depende de columnas agregadas en la
// migración de la Fase 9 (apellido_paciente). Si esa migración todavía no se
// aplicó en este entorno, no queremos que un error acá tumbe también la
// sección de "Dispositivos Sospechosos" de arriba, que no depende de ella.
$enlacesMultiPaciente = [];
try {
    $stmtEnlaces = $db->query(
        "SELECT en.device_id, count(DISTINCT el.id) AS total_enlaces,
                json_agg(json_build_object(
                           'codigo', el.codigo,
                           'nombre_paciente', el.nombre_paciente,
                           'apellido_paciente', el.apellido_paciente,
                           'telefono', el.telefono,
                           'encuesta_id', en.id,
                           'fecha_creacion', en.fecha_creacion
                         ) ORDER BY en.fecha_creacion DESC) AS enlaces
         FROM encuestas en
         JOIN enlaces_encuesta el ON el.encuesta_id = en.id
         WHERE en.device_id IS NOT NULL
         GROUP BY en.device_id
         HAVING count(DISTINCT el.id) > 1
         ORDER BY total_enlaces DESC"
    );
    $enlacesMultiPaciente = $stmtEnlaces->fetchAll();
    foreach ($enlacesMultiPaciente as &$row) {
        $row['enlaces'] = json_decode($row['enlaces'], true);
        $row['total_enlaces'] = (int) $row['total_enlaces'];
    }
    unset($row);
} catch (PDOException $e) {
    error_log('dispositivos-sospechosos.php: fallo la consulta de enlaces_multi_paciente: ' . $e->getMessage());
    $enlacesMultiPaciente = [];
}

json_ok(['dispositivos' => $rows, 'enlaces_multi_paciente' => $enlacesMultiPaciente]);
