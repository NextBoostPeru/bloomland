<?php

namespace App\Models;

use App\Config\Database;
use PDO;

class User
{
    private $conn;
    private $table = 'users';

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }

    public function findByEmail($email)
    {
        // Join with roles table to get role name
        $query = "SELECT u.*, r.name as role_name 
                  FROM " . $this->table . " u
                  LEFT JOIN roles r ON u.role_id = r.id
                  WHERE u.email = :email LIMIT 1";
                  
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();
        return $stmt->fetch();
    }

    public function findByUsernameOrEmail($login)
    {
        // Support login by email or document number (DNI/CE)
        $query = "SELECT u.*, r.name as role_name 
                  FROM " . $this->table . " u
                  LEFT JOIN roles r ON u.role_id = r.id
                  WHERE u.email = :email OR u.doc_number = :doc_number LIMIT 1";
                  
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $login);
        $stmt->bindParam(':doc_number', $login);
        $stmt->execute();
        return $stmt->fetch();
    }
    
    public function findById($id)
    {
        $query = "SELECT u.*, r.name as role_name 
                  FROM " . $this->table . " u
                  LEFT JOIN roles r ON u.role_id = r.id
                  WHERE u.id = :id LIMIT 1";
                  
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        return $stmt->fetch();
    }
    
    public function getAll($limit = 10, $offset = 0)
    {
        $query = "SELECT u.id, u.email, u.first_name, u.last_name_paternal, u.created_at, r.name as role_name 
                  FROM " . $this->table . " u
                  LEFT JOIN roles r ON u.role_id = r.id
                  LIMIT :limit OFFSET :offset";
                  
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function create($data)
    {
        // Adapted to new table structure
        $query = "INSERT INTO " . $this->table . " 
                  (role_id, email, password, doc_type, doc_number, first_name, last_name_paternal, last_name_maternal) 
                  VALUES (:role_id, :email, :password, :doc_type, :doc_number, :first_name, :last_name_paternal, :last_name_maternal)";
        
        $stmt = $this->conn->prepare($query);
        
        $password = $data['password'];
        $hashed_password = password_hash($password, PASSWORD_DEFAULT);

        $stmt->bindParam(':role_id', $data['role_id']);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':password', $hashed_password);
        $stmt->bindParam(':doc_type', $data['doc_type']);
        $stmt->bindParam(':doc_number', $data['doc_number']);
        $stmt->bindParam(':first_name', $data['first_name']);
        $stmt->bindParam(':last_name_paternal', $data['last_name_paternal']);
        $stmt->bindParam(':last_name_maternal', $data['last_name_maternal']);
        
        if ($stmt->execute()) {
            return $this->conn->lastInsertId();
        }
        return false;
    }

    public function updatePassword($email, $newPassword)
    {
        $query = "UPDATE " . $this->table . " SET password = :password WHERE email = :email";
        
        $stmt = $this->conn->prepare($query);
        
        $hashed_password = password_hash($newPassword, PASSWORD_DEFAULT);
        
        $stmt->bindParam(':password', $hashed_password);
        $stmt->bindParam(':email', $email);
        
        return $stmt->execute();
    }
}
