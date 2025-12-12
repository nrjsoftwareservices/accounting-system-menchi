<?php

$defaultOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
];

$envOrigins = env('CORS_ALLOWED_ORIGINS');
$allowedOrigins = $envOrigins
    ? array_map('trim', explode(',', $envOrigins))
    : $defaultOrigins;

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_filter($allowedOrigins),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => ['Authorization', 'X-Org-Id'],
    'max_age' => 0,
    'supports_credentials' => false,
];
