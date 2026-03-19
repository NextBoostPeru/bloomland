<?php

namespace App;

use App\Utils\Response;

class Router
{
    private $routes = [];

    public function add($method, $path, $handler, $middleware = [])
    {
        $this->routes[] = [
            'method' => $method,
            'path' => $path,
            'handler' => $handler,
            'middleware' => $middleware
        ];
    }

    public function dispatch()
    {
        $method = $_SERVER['REQUEST_METHOD'];
        
        // Support method override for PUT/DELETE
        if ($method === 'POST') {
            if (isset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
                $method = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
            } elseif (isset($_POST['_method'])) {
                $method = strtoupper($_POST['_method']);
            } else {
                // Check JSON input for _method
                $input = json_decode(file_get_contents('php://input'), true);
                if (isset($input['_method'])) {
                    $method = strtoupper($input['_method']);
                }
            }
        }

        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        
        // Remove base path if any (XAMPP subdirectory support)
        $scriptName = $_SERVER['SCRIPT_NAME'];
        $basePath = dirname($scriptName);
        
        if ($basePath !== '/' && $basePath !== '\\' && $basePath !== '.') {
            // Replace backslashes with forward slashes for consistency
            $basePath = str_replace('\\', '/', $basePath);
            if (strpos($uri, $basePath) === 0) {
                $uri = substr($uri, strlen($basePath));
            }
        }
        
        // Ensure uri starts with / and handle empty uri
        if (empty($uri)) $uri = '/';
        if ($uri[0] !== '/') $uri = '/' . $uri;
        
        foreach ($this->routes as $route) {
            // Simple pattern matching for {id} (including hyphens)
            $pattern = "@^" . preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<$1>[a-zA-Z0-9_-]+)', $route['path']) . "$@D";
            
            if ($route['method'] == $method && preg_match($pattern, $uri, $matches)) {
                
                // Run Middleware
                foreach ($route['middleware'] as $mw) {
                    call_user_func($mw);
                }

                // Extract params
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);

                // Call Handler
                [$controllerName, $action] = $route['handler'];
                $controller = new $controllerName();
                // Use array_values to pass parameters positionally, avoiding named parameter mismatches
                call_user_func_array([$controller, $action], array_values($params));
                return;
            }
        }

        Response::error('Not Found', 404);
    }
}
