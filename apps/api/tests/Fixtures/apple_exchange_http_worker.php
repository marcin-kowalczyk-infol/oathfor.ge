<?php

declare(strict_types=1);

use App\Kernel;
use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\HttpFoundation\Request;

require dirname(__DIR__, 2).'/vendor/autoload.php';
(new Dotenv())->bootEnv(dirname(__DIR__, 2).'/.env');
$kernel = new Kernel('test', false);
$path = $_SERVER['argv'][1];
$response = $kernel->handle(Request::create($path, '/api/health' === $path ? 'GET' : 'POST', server: ['CONTENT_TYPE' => 'application/json'], content: '{}'));
echo json_encode([$response->getStatusCode(), $response->headers->get('Cache-Control'), $response->getContent()], JSON_THROW_ON_ERROR);
