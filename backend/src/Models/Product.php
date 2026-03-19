<?php

namespace App\Models;

use App\Config\Database;
use PDO;

class Product
{
    private $conn;
    private $table_posts;
    private $table_postmeta;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
        $prefix = $_ENV['WP_TABLE_PREFIX'] ?? 'wp_';
        $this->table_posts = $prefix . 'posts';
        $this->table_postmeta = $prefix . 'postmeta';
    }

    public function getAll($limit = 10, $offset = 0)
    {
        // Simple fetch of products. 
        // In real WC, you need to join postmeta for price, stock, etc.
        $query = "SELECT ID, post_title, post_content, post_status, post_date 
                  FROM " . $this->table_posts . " 
                  WHERE post_type = 'product' AND post_status = 'publish' 
                  LIMIT :limit OFFSET :offset";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $products = $stmt->fetchAll();
        
        // Enrich with meta data (Price, Stock)
        foreach ($products as &$product) {
            $product['price'] = $this->getMeta($product['ID'], '_price');
            $product['stock_status'] = $this->getMeta($product['ID'], '_stock_status');
            $product['stock_quantity'] = $this->getMeta($product['ID'], '_stock');
        }
        
        return $products;
    }

    public function getById($id)
    {
        $query = "SELECT ID, post_title, post_content, post_status 
                  FROM " . $this->table_posts . " 
                  WHERE ID = :id AND post_type = 'product' LIMIT 1";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        $product = $stmt->fetch();
        
        if ($product) {
            $product['price'] = $this->getMeta($id, '_price');
            $product['regular_price'] = $this->getMeta($id, '_regular_price');
            $product['sale_price'] = $this->getMeta($id, '_sale_price');
            $product['sku'] = $this->getMeta($id, '_sku');
            $product['stock_quantity'] = $this->getMeta($id, '_stock');
        }
        
        return $product;
    }

    private function getMeta($post_id, $key)
    {
        $query = "SELECT meta_value FROM " . $this->table_postmeta . " WHERE post_id = :post_id AND meta_key = :key LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':post_id', $post_id);
        $stmt->bindParam(':key', $key);
        $stmt->execute();
        $res = $stmt->fetch();
        return $res ? $res['meta_value'] : null;
    }
}
