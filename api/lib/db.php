<?php

function get_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $config = require __DIR__ . '/../config.php';
        $db = $config['db'];
        $dsn = "pgsql:host={$db['host']};port={$db['port']};dbname={$db['dbname']}";
        $pdo = new PDO($dsn, $db['user'], $db['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}
