<?php
require __DIR__ . '/../bootstrap.php';

$payload = require_auth();
json_ok(['email' => $payload['email']]);
