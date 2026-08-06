<?php
// Uso: php seed_admin.php admin@ejemplo.com "contraseñaSegura123"
require __DIR__ . '/../lib/db.php';

if ($argc !== 3) {
    fwrite(STDERR, "Uso: php seed_admin.php <email> <password>\n");
    exit(1);
}

[$_, $email, $password] = $argv;
$hash = password_hash($password, PASSWORD_BCRYPT);

$db = get_db();
$stmt = $db->prepare(
    'INSERT INTO admins (email, password_hash) VALUES (:email, :hash)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash'
);
$stmt->execute(['email' => $email, 'hash' => $hash]);

echo "Admin '$email' creado/actualizado correctamente.\n";
