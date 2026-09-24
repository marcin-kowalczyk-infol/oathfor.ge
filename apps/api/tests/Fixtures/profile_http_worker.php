<?php

declare(strict_types=1);

use App\Kernel;
use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\HttpFoundation\Request;

require dirname(__DIR__, 2).'/vendor/autoload.php';
(new Dotenv())->bootEnv(dirname(__DIR__, 2).'/.env');
$kernel = new Kernel('test', false);
$response = $kernel->handle(Request::create($_SERVER['argv'][2], $_SERVER['argv'][1], server: ['HTTP_AUTHORIZATION' => 'Bearer '.str_repeat('A', 43), 'CONTENT_TYPE' => 'application/json'], content: '{}'));
echo json_encode([$response->getStatusCode(), $response->headers->get('Cache-Control'), $response->getContent()], JSON_THROW_ON_ERROR);
