<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use PDO;

class ReportController
{
    private $conn;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }

    public function getSalesReport()
    {
        try {
            $startDate = $_GET['start_date'] ?? date('Y-m-01');
            $endDate = $_GET['end_date'] ?? date('Y-m-d');

            $sql = "SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as total_orders,
                        SUM(total_amount) as total_sales
                    FROM orders 
                    WHERE created_at BETWEEN :start_date AND :end_date
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC";

            $stmt = $this->conn->prepare($sql);
            $stmt->execute([':start_date' => "$startDate 00:00:00", ':end_date' => "$endDate 23:59:59"]);
            $dailySales = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Summary
            $stmtSummary = $this->conn->prepare("SELECT SUM(total_amount) as total_revenue, COUNT(*) as count FROM orders WHERE created_at BETWEEN :start_date AND :end_date");
            $stmtSummary->execute([':start_date' => "$startDate 00:00:00", ':end_date' => "$endDate 23:59:59"]);
            $summary = $stmtSummary->fetch(PDO::FETCH_ASSOC);

            Response::json([
                'summary' => $summary,
                'daily_sales' => $dailySales
            ]);
        } catch (\Exception $e) {
            Response::json(['message' => 'Datos de ventas no disponibles', 'error' => $e->getMessage(), 'daily_sales' => []]);
        }
    }

    public function getStockReport()
    {
        try {
            // Products with low stock
            $sql = "SELECT p.name, p.sku, p.stock_quantity, p.min_stock_alert as min_stock_level 
                    FROM products p 
                    WHERE p.stock_quantity <= p.min_stock_alert 
                    ORDER BY p.stock_quantity ASC";
            
            $stmt = $this->conn->query($sql);
            $lowStock = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Total valuation (approximate)
            $sqlVal = "SELECT SUM(stock_quantity * price_pen) as total_value FROM products";
            $stmtVal = $this->conn->query($sqlVal);
            $valuation = $stmtVal->fetchColumn();

            Response::json([
                'low_stock' => $lowStock,
                'inventory_valuation' => $valuation
            ]);
        } catch (\Exception $e) {
            Response::json(['message' => 'Datos de inventario no disponibles', 'error' => $e->getMessage()]);
        }
    }

    public function getFinancialReport()
    {
        try {
            $startDate = $_GET['start_date'] ?? date('Y-m-01');
            $endDate = $_GET['end_date'] ?? date('Y-m-d');

            // Income vs Expenses from expenses table (Caja Chica)
            $sql = "SELECT type, SUM(amount) as total 
                    FROM expenses 
                    WHERE expense_date BETWEEN :start_date AND :end_date
                    GROUP BY type";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([':start_date' => $startDate, ':end_date' => $endDate]);
            $results = $stmt->fetchAll(PDO::FETCH_KEY_PAIR); // ['income' => 1000, 'expense' => 500]

            Response::json([
                'income' => $results['income'] ?? 0,
                'expense' => $results['expense'] ?? 0,
                'balance' => ($results['income'] ?? 0) - ($results['expense'] ?? 0)
            ]);
        } catch (\Exception $e) {
            Response::json(['message' => 'Datos financieros no disponibles', 'error' => $e->getMessage()]);
        }
    }
}
