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

// Postgres devuelve TEXT[] como literal de texto (ej. '{"a","b c"}'), no como array PHP.
function pg_text_array_to_php(?string $raw): array {
    if ($raw === null || $raw === '{}') return [];
    $inner = substr($raw, 1, -1);
    if ($inner === '') return [];
    preg_match_all('/"((?:[^"\\\\]|\\\\.)*)"|([^,]+)/', $inner, $matches, PREG_SET_ORDER);
    $result = [];
    foreach ($matches as $m) {
        $isQuoted = isset($m[0][0]) && $m[0][0] === '"';
        $result[] = $isQuoted
            ? str_replace(['\\"', '\\\\'], ['"', '\\'], $m[1])
            : $m[2];
    }
    return $result;
}
