<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:5173',   // student web
        'http://localhost:5174',   // admin web
        'http://localhost:8081',   // Expo dev server
        'http://localhost:19000',  // Expo Go
        'http://localhost:19006',  // Expo web
        '*',                       // allow all (covers your phone's IP)
    ],

    'allowed_origins_patterns' => [
        '/^exp:\/\/.*/',           // Expo app scheme
        '/^http:\/\/192\.168\..*/',// local network IPs (your phone)
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false, // ← changed to false when using '*'

];