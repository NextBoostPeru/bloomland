<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use PDO;

class StockController
{
    private $conn;
    private $table_postmeta;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
        $prefix = $_ENV['WP_TABLE_PREFIX'] ?? 'wp_';
        $this->table_postmeta = $prefix . 'postmeta';
    }

    public function index()
    {
        // Get all products with stock managed
        $query = "SELECT post_id, meta_value as stock_quantity 
                  FROM " . $this->table_postmeta . " 
                  WHERE meta_key = '_stock' AND meta_value != '' 
                  LIMIT 100"; // Pagination should be used here
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        Response::json($stmt->fetchAll());
    }

    public function update()
    {
        $data = json_decode(file_get_contents("php://input"));
        
        if (!isset($data->product_id) || !isset($data->quantity)) {
            Response::error('Product ID and Quantity required');
        }

        // Update stock
        $query = "UPDATE " . $this->table_postmeta . " 
                  SET meta_value = :quantity 
                  WHERE post_id = :id AND meta_key = '_stock'";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':quantity', $data->quantity);
        $stmt->bindParam(':id', $data->product_id);
        
        if ($stmt->execute()) {
            // Also update stock status
            $status = $data->quantity > 0 ? 'instock' : 'outofstock';
            $q2 = "UPDATE " . $this->table_postmeta . " 
                   SET meta_value = :status 
                   WHERE post_id = :id AND meta_key = '_stock_status'";
            $s2 = $this->conn->prepare($q2);
            $s2->bindParam(':status', $status);
            $s2->bindParam(':id', $data->product_id);
            $s2->execute();

            Response::json(['message' => 'Stock updated']);
        } else {
            Response::error('Failed to update stock', 500);
        }
    }
}
