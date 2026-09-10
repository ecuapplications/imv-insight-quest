<?php
require __DIR__ . '/bootstrap.php';
require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('Método no permitido', 405);
}

$stmt = get_db()->query(
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

json_ok($rows);
