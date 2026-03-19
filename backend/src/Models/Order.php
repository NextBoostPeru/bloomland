<?php

namespace App\Models;

use App\Config\Database;
use PDO;

class Order
{
    private $conn;
    private $table_posts;
    private $table_items;
    private $table_itemmeta;
    private $table_order_stats;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
        $prefix = $_ENV['WP_TABLE_PREFIX'] ?? 'wp_';
        $this->table_posts = $prefix . 'posts';
        $this->table_items = $prefix . 'woocommerce_order_items';
        $this->table_itemmeta = $prefix . 'woocommerce_order_itemmeta';
        $this->table_order_stats = $prefix . 'wc_order_stats';
    }

    public function getAll($limit = 10, $offset = 0)
    {
        // Ideally use wc_order_stats for performance if available
        $query = "SELECT order_id, status, date_created, total_sales, num_items_sold, customer_id 
                  FROM " . $this->table_order_stats . " 
                  ORDER BY date_created DESC
                  LIMIT :limit OFFSET :offset";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        
        return $stmt->fetchAll();
    }

    public function getById($id)
    {
        // Get order details
        $query = "SELECT * FROM " . $this->table_order_stats . " WHERE order_id = :id LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $order = $stmt->fetch();
        
        if ($order) {
            $order['items'] = $this->getItems($id);
        }
        
        return $order;
    }

    public function getItems($order_id)
    {
        $query = "SELECT order_item_id, order_item_name, order_item_type 
                  FROM " . $this->table_items . " 
                  WHERE order_id = :id AND order_item_type = 'line_item'";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $order_id);
        $stmt->execute();
        $items = $stmt->fetchAll();

        // Get meta for each item (product id, qty, total)
        foreach ($items as &$item) {
            $item['product_id'] = $this->getItemMeta($item['order_item_id'], '_product_id');
            $item['qty'] = $this->getItemMeta($item['order_item_id'], '_qty');
            $item['total'] = $this->getItemMeta($item['order_item_id'], '_line_total');
        }

        return $items;
    }

    private function getItemMeta($item_id, $key)
    {
        $query = "SELECT meta_value FROM " . $this->table_itemmeta . " WHERE order_item_id = :id AND meta_key = :key LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $item_id);
        $stmt->bindParam(':key', $key);
        $stmt->execute();
        $res = $stmt->fetch();
        return $res ? $res['meta_value'] : null;
    }
}
