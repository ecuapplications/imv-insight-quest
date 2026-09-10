<?php
return [
    'db' => [
        'host' => 'localhost',
        'port' => '5432',
        'dbname' => 'CAMBIAR_NOMBRE_DB',
        'user' => 'CAMBIAR_USUARIO',
        'password' => 'CAMBIAR_PASSWORD',
    ],
    'jwt_secret' => 'CAMBIAR_POR_UN_SECRETO_LARGO_Y_ALEATORIO',
    'jwt_ttl_seconds' => 8 * 60 * 60,
    'cors_origin' => getenv('APP_ENV') === 'dev' ? 'http://localhost:8080' : null,
    'rate_limit_ip_por_hora' => 10,
    // Notificaciones push (Web Push / VAPID). Generar un par una sola vez con:
    // php -r "require 'vendor/autoload.php'; print_r((new Minishlink\WebPush\VAPID)::createVapidKeys());"
    'vapid' => [
        'public_key' => 'CAMBIAR_CLAVE_PUBLICA_VAPID',
        'private_key' => 'CAMBIAR_CLAVE_PRIVADA_VAPID',
        'subject' => 'mailto:admin@imvcientific.com',
    ],
];
