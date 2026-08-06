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
];
