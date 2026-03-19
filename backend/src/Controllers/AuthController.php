<?php

namespace App\Controllers;

use App\Models\User;
use App\Models\PasswordReset;
use App\Services\EmailService;
use App\Utils\Response;
use Firebase\JWT\JWT;

class AuthController
{
    public function forgotPassword()
    {
        $data = json_decode(file_get_contents("php://input"));
        $email = $data->email ?? null;

        if (!$email) {
            Response::error('El correo electrónico es requerido');
        }

        $userModel = new User();
        $user = $userModel->findByEmail($email);

        if (!$user) {
            // Return success even if user not found to prevent enumeration
            Response::json(['message' => 'Si el correo existe, recibirás un enlace de recuperación.']);
        }

        $token = bin2hex(random_bytes(32));
        $passwordResetModel = new PasswordReset();
        
        if ($passwordResetModel->createToken($email, $token)) {
            $emailService = new EmailService();
            if ($emailService->sendPasswordReset($email, $token)) {
                Response::json(['message' => 'Si el correo existe, recibirás un enlace de recuperación.']);
            } else {
                Response::error('Error al enviar el correo de recuperación', 500);
            }
        } else {
            Response::error('Error al generar el token de recuperación', 500);
        }
    }

    public function resetPassword()
    {
        $data = json_decode(file_get_contents("php://input"));
        $email = $data->email ?? null;
        $token = $data->token ?? null;
        $password = $data->password ?? null;

        if (!$email || !$token || !$password) {
            Response::error('Email, token y nueva contraseña son requeridos');
        }

        $passwordResetModel = new PasswordReset();
        $resetRecord = $passwordResetModel->findByTokenAndEmail($token, $email);

        if (!$resetRecord) {
            Response::error('Token inválido o expirado', 400);
        }

        $userModel = new User();
        if ($userModel->updatePassword($email, $password)) {
            $passwordResetModel->deleteByEmail($email);
            Response::json(['message' => 'Contraseña actualizada correctamente']);
        } else {
            Response::error('Error al actualizar la contraseña', 500);
        }
    }

    public function login()
    {
        $data = json_decode(file_get_contents("php://input"));

        // Support login by email or document number (via 'identifier' or similar field from frontend)
        // Frontend sends { identifier: '...', password: '...' }
        // We map it to what User model expects
        
        $login = $data->email ?? $data->identifier ?? $data->username ?? null;
        
        if (!$login || !isset($data->password)) {
             Response::error('Identificador y contraseña son requeridos');
        }

        $userModel = new User();
        $user = $userModel->findByUsernameOrEmail($login);

        if (!$user) {
            Response::json([
                'error' => true, 
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        // Check password
        if (!password_verify($data->password, $user['password'])) {
             Response::json([
                'error' => true, 
                'message' => 'Contraseña incorrecta'
            ], 401);
        }

        // Role comes directly from JOIN query now
        $role = $user['role_name'] ?? 'Guest';

        $secret = $_ENV['JWT_SECRET'] ?? getenv('JWT_SECRET');
        $expiration = $_ENV['JWT_EXPIRATION'] ?? getenv('JWT_EXPIRATION') ?? 3600;

        $payload = [
            'iss' => 'erp-api',
            'aud' => 'erp-panel',
            'iat' => time(),
            'exp' => time() + $expiration,
            'data' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'doc_number' => $user['doc_number'],
                'first_name' => $user['first_name'],
                'role' => $role
            ]
        ];

        $jwt = JWT::encode($payload, $secret, 'HS256');

        Response::json([
            'token' => $jwt,
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'doc_number' => $user['doc_number'],
                'first_name' => $user['first_name'],
                'last_name' => $user['last_name_paternal'],
                'role' => $role
            ]
        ]);
    }

    public function me()
    {
        $user = \App\Middleware\AuthMiddleware::authenticate();
        Response::json(['user' => $user]);
    }

    public function logout()
    {
        // Stateless logout (Client must remove token)
        Response::json([
            'message' => 'Sesión cerrada correctamente',
            'instruction' => 'Eliminar token de almacenamiento local.'
        ]);
    }
}
