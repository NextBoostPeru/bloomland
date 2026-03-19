<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use PDO;

class FinanceController
{
    private $conn;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }

    public function summary()
    {
        try {
            // Total Bank Balance
            $stmt = $this->conn->query("SELECT SUM(balance) as total FROM bank_accounts WHERE is_active = 1 AND currency = 'PEN'");
            $totalBank = $stmt->fetchColumn() ?: 0;

            // Expenses this month
            $startOfMonth = date('Y-m-01');
            
            // Total Expenses
            $stmt = $this->conn->prepare("SELECT SUM(amount) FROM expenses WHERE expense_date >= ? AND type = 'expense'");
            $stmt->execute([$startOfMonth]);
            $expensesMonth = $stmt->fetchColumn() ?: 0;

            // Total Income
            $stmt = $this->conn->prepare("SELECT SUM(amount) FROM expenses WHERE expense_date >= ? AND type = 'income'");
            $stmt->execute([$startOfMonth]);
            $incomeMonth = $stmt->fetchColumn() ?: 0;

            Response::json([
                'bank_balance_pen' => (float)$totalBank,
                'expenses_month' => (float)$expensesMonth,
                'income_month' => (float)$incomeMonth
            ]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    // --- EXPENSES (Caja Chica) ---

    public function getExpenses()
    {
        try {
            $page = $_GET['page'] ?? 1;
            $limit = $_GET['limit'] ?? 20;
            $offset = ($page - 1) * $limit;
            $type = $_GET['type'] ?? null;
            
            $sql = "SELECT e.*, u.first_name as user_name 
                    FROM expenses e 
                    LEFT JOIN users u ON e.user_id = u.id ";
            
            $params = [];
            if ($type) {
                $sql .= " WHERE e.type = :type ";
                $params[':type'] = $type;
            }

            $sql .= " ORDER BY e.expense_date DESC, e.created_at DESC 
                      LIMIT :limit OFFSET :offset";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
            if ($type) {
                $stmt->bindParam(':type', $type);
            }
            $stmt->execute();
            $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Count total
            $countSql = "SELECT COUNT(*) FROM expenses";
            if ($type) {
                $countSql .= " WHERE type = '$type'";
            }
            $countStmt = $this->conn->query($countSql);
            $total = $countStmt->fetchColumn();

            Response::json([
                'data' => $expenses,
                'pagination' => [
                    'page' => (int)$page,
                    'limit' => (int)$limit,
                    'total' => (int)$total,
                    'pages' => ceil($total / $limit)
                ]
            ]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function createExpense()
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (empty($data['amount']) || empty($data['description'])) {
                Response::error("Monto y descripción son requeridos");
            }

            $sql = "INSERT INTO expenses (user_id, amount, description, category, expense_date, type) VALUES (?, ?, ?, ?, ?, ?)";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                $data['user_id'] ?? null, // Should come from auth token ideally
                $data['amount'],
                $data['description'],
                $data['category'] ?? 'General',
                $data['expense_date'] ?? date('Y-m-d'),
                $data['type'] ?? 'expense'
            ]);

            Response::json(['success' => true, 'id' => $this->conn->lastInsertId(), 'message' => 'Movimiento registrado']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function deleteExpense($id)
    {
        try {
            $stmt = $this->conn->prepare("DELETE FROM expenses WHERE id = ?");
            $stmt->execute([$id]);
            Response::json(['success' => true, 'message' => 'Gasto eliminado']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    // --- BANKS ---

    public function getBankAccounts()
    {
        try {
            $stmt = $this->conn->query("SELECT * FROM bank_accounts WHERE is_active = 1");
            Response::json($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function createBankAccount()
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            $sql = "INSERT INTO bank_accounts (bank_name, account_number, currency, balance, account_type) VALUES (?, ?, ?, ?, ?)";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                $data['bank_name'],
                $data['account_number'],
                $data['currency'] ?? 'PEN',
                $data['balance'] ?? 0.00,
                $data['account_type'] ?? 'Ahorros'
            ]);

            Response::json(['success' => true, 'id' => $this->conn->lastInsertId()]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function updateBankAccount($id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            $fields = [];
            $params = [];

            if (array_key_exists('bank_name', $data)) {
                $fields[] = "bank_name = ?";
                $params[] = $data['bank_name'];
            }
            if (array_key_exists('account_number', $data)) {
                $fields[] = "account_number = ?";
                $params[] = $data['account_number'];
            }
            if (array_key_exists('currency', $data)) {
                $fields[] = "currency = ?";
                $params[] = $data['currency'];
            }
            if (array_key_exists('balance', $data)) {
                $fields[] = "balance = ?";
                $params[] = $data['balance'];
            }
            if (array_key_exists('account_type', $data)) {
                $fields[] = "account_type = ?";
                $params[] = $data['account_type'];
            }
            if (array_key_exists('description', $data)) {
                $fields[] = "description = ?";
                $params[] = $data['description'];
            }

            if (empty($fields)) {
                Response::error('No hay datos para actualizar');
            }

            $params[] = $id;

            $sql = "UPDATE bank_accounts SET " . implode(', ', $fields) . " WHERE id = ?";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);

            Response::json(['success' => true]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function getBankMovements($accountId)
    {
        try {
            $limit = $_GET['limit'] ?? 50;
            $stmt = $this->conn->prepare("SELECT * FROM bank_movements WHERE bank_account_id = ? ORDER BY transaction_date DESC LIMIT ?");
            $stmt->bindParam(1, $accountId, PDO::PARAM_INT);
            $stmt->bindParam(2, $limit, PDO::PARAM_INT);
            $stmt->execute();
            Response::json($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function createBankMovement()
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            $this->conn->beginTransaction();

            $sql = "INSERT INTO bank_movements (bank_account_id, type, amount, description, transaction_date) VALUES (?, ?, ?, ?, ?)";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                $data['bank_account_id'],
                $data['type'],
                $data['amount'],
                $data['description'],
                $data['transaction_date'] ?? date('Y-m-d')
            ]);

            // Update balance
            $operator = $data['type'] === 'income' ? '+' : '-';
            $updateSql = "UPDATE bank_accounts SET balance = balance $operator ? WHERE id = ?";
            $updateStmt = $this->conn->prepare($updateSql);
            $updateStmt->execute([$data['amount'], $data['bank_account_id']]);

            $this->conn->commit();
            Response::json(['success' => true, 'message' => 'Movimiento registrado']);
        } catch (\Exception $e) {
            $this->conn->rollBack();
            Response::error($e->getMessage());
        }
    }
}
