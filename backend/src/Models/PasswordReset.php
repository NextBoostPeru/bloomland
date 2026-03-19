<?php

namespace App\Models;

use App\Config\Database;
use PDO;

class PasswordReset
{
    private $conn;
    private $table = 'password_resets';

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }

    public function createToken($email, $token)
    {
        // Delete existing tokens for this email
        $this->deleteByEmail($email);

        $query = "INSERT INTO " . $this->table . " (email, token, created_at, expires_at) VALUES (:email, :token, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR))";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':token', $token);
        
        return $stmt->execute();
    }

    public function findByTokenAndEmail($token, $email)
    {
        $query = "SELECT * FROM " . $this->table . " WHERE email = :email AND token = :token AND expires_at > NOW() LIMIT 1";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':token', $token);
        $stmt->execute();
        
        return $stmt->fetch();
    }

    public function deleteByEmail($email)
    {
        $query = "DELETE FROM " . $this->table . " WHERE email = :email";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        
        return $stmt->execute();
    }
}
