<?php
// Uso: php seed_admin.php admin@ejemplo.com "contraseñaSegura123" [admin|recepcion]
require __DIR__ . '/../lib/db.php';

if ($argc < 3 || $argc > 4) {
    fwrite(STDERR, "Uso: php seed_admin.php <email> <password> [admin|recepcion]\n");
    exit(1);
}

$email = $argv[1];
$password = $argv[2];
$role = $argv[3] ?? 'admin';
if (!in_array($role, ['admin', 'recepcion'], true)) {
    fwrite(STDERR, "Rol inválido: $role (debe ser 'admin' o 'recepcion')\n");
    exit(1);
}
$hash = password_hash($password, PASSWORD_BCRYPT);

$db = get_db();
$stmt = $db->prepare(
    'INSERT INTO admins (email, password_hash, role) VALUES (:email, :hash, :role)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role'
);
$stmt->execute(['email' => $email, 'hash' => $hash, 'role' => $role]);

echo "Admin '$email' (rol: $role) creado/actualizado correctamente.\n";
