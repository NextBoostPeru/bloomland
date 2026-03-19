<?php

namespace App\Middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use App\Utils\Response;

class AuthMiddleware
{
    public static function authenticate()
    {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        $jwt = null;

        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $jwt = $matches[1];
        } elseif (isset($_GET['token'])) {
            $jwt = $_GET['token'];
        }

        if (!$jwt) {
            Response::error('Token not found', 401);
        }

        try {
            $secret = $_ENV['JWT_SECRET'];
            $decoded = JWT::decode($jwt, new Key($secret, 'HS256'));
            
            return (array) $decoded->data; // Return user data from token
        } catch (\Exception $e) {
            Response::error('Invalid Token: ' . $e->getMessage(), 401);
        }
    }

    public static function authorize($allowedRoles = [])
    {
        $user = self::authenticate();
        
        // If roles are empty, just authentication is required
        if (empty($allowedRoles)) {
            return $user;
        }

        // Check if user has one of the allowed roles
        // We assume the JWT token contains the roles array or single role
        
        // Ensure roles is an array
        $userRoles = [];
        if (isset($user['roles'])) {
            $userRoles = (array)$user['roles'];
        } elseif (isset($user['role'])) {
            $userRoles = [$user['role']];
        }

        if (empty(array_intersect($allowedRoles, $userRoles))) {
            Response::error('Forbidden: Insufficient permissions', 403);
        }

        return $user;
    }
}
