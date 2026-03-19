<?php
namespace App\Controllers;

use App\Services\PeruDevService;
use App\Utils\Response;

class ExternalServiceController {
    private $service;

    public function __construct() {
        $this->service = new PeruDevService();
    }

    public function consultRuc($ruc) {
        $result = $this->service->getRuc($ruc);
        
        if ($result['success']) {
            Response::json($result['data']);
        } else {
            Response::json(['error' => $result['message']], 400);
        }
    }

    public function consultDni($dni) {
        $result = $this->service->getDni($dni);
        
        if ($result['success']) {
            Response::json($result['data']);
        } else {
            Response::json(['error' => $result['message']], 400);
        }
    }
}
