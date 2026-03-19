<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Services\EmailService;
use PDO;

class SettingsController
{
    private $conn;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }

    public function testEmail()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $email = $data['email'] ?? null;

        if (!$email) {
            Response::error("El correo de destino es requerido");
        }

        $emailService = new EmailService();
        $result = $emailService->sendTestEmail($email);

        if ($result['success']) {
            Response::json(['success' => true, 'message' => $result['message']]);
        } else {
            Response::error("Error al enviar el correo de prueba: " . $result['message'], 500);
        }
    }

    // Alias for legacy route support if needed
    public function getSettings() {
        return $this->index();
    }

    public function updateSettings() {
        return $this->update();
    }

    public function index()
    {
        try {
            // First try with the new 'settings' table (key-value)
            $useKV = false;
            try {
                $stmt = $this->conn->query("SELECT 1 FROM settings LIMIT 1");
                $useKV = true;
            } catch (\Exception $e) {
                $useKV = false;
            }

            if ($useKV) {
                $this->indexKV();
                return;
            }

            // Fallback to 'company_settings' table
            // Check if table exists first
            try {
                $stmt = $this->conn->query("SELECT 1 FROM company_settings LIMIT 1");
            } catch (\Exception $e) {
                // No tables found, return defaults
                Response::json($this->getDefaults());
                return;
            }

            $stmt = $this->conn->query("SELECT * FROM company_settings LIMIT 1");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$row) {
                Response::json($this->getDefaults());
                return;
            }

            // Map old table columns to frontend keys
            $settings = [
                'company_name' => $row['company_name'] ?? $row['business_name'] ?? '',
                'company_ruc' => $row['ruc'] ?? '',
                'company_address' => $row['address'] ?? '',
                'company_logo' => $row['logo_url'] ?? '',
                'company_phone' => $row['phone'] ?? '',
                'company_email' => $row['email'] ?? '',
                'smtp_host' => $row['smtp_host'] ?? '',
                'smtp_port' => $row['smtp_port'] ?? '',
                'smtp_user' => $row['smtp_user'] ?? '',
                'smtp_pass' => $row['smtp_password'] ?? '',
                'woocommerce_url' => $row['woocommerce_url'] ?? '',
                'woocommerce_key' => $row['woocommerce_consumer_key'] ?? '',
                'woocommerce_secret' => $row['woocommerce_consumer_secret'] ?? '',
                'electronic_billing_enabled' => $row['electronic_billing_enabled'] ?? '0',
                'api_perudev_token' => $row['api_perudev_token'] ?? ''
            ];

            Response::json(array_merge($this->getDefaults(), $settings));
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    private function getDefaults() {
        return [
            'company_name' => '', 'company_ruc' => '', 'company_address' => '', 'company_logo' => '',
            'company_phone' => '', 'company_email' => '', 'smtp_host' => '', 'smtp_port' => '',
            'smtp_user' => '', 'smtp_pass' => '', 'electronic_billing_enabled' => '0',
            'api_perudev_token' => '', 'woocommerce_url' => '', 'woocommerce_key' => '', 'woocommerce_secret' => '',
            'woocommerce_enabled' => '0',
            'nubefact_url' => '', 'nubefact_token' => ''
        ];
    }

    private function indexKV()
    {
        $stmt = $this->conn->query("SELECT setting_key, setting_value FROM settings");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }

        Response::json(array_merge($this->getDefaults(), $settings));
    }

    public function update()
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data) Response::error("Datos inválidos");

            // Try to detect which table to use
            $useKV = false;
            try {
                $this->conn->query("SELECT 1 FROM settings LIMIT 1");
                $useKV = true;
            } catch (\Exception $e) {
                $useKV = false;
            }

            if ($useKV) {
                $this->updateKV($data);
            } else {
                $this->updateLegacy($data);
            }
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    private function updateKV($data)
    {
        $keyGroups = [
            'company_name' => 'company', 'company_ruc' => 'company', 'company_address' => 'company',
            'company_logo' => 'company', 'company_phone' => 'company', 'company_email' => 'company',
            'smtp_host' => 'email', 'smtp_port' => 'email', 'smtp_user' => 'email', 'smtp_pass' => 'email',
            'electronic_billing_enabled' => 'billing', 'api_perudev_token' => 'billing',
            'woocommerce_url' => 'woocommerce', 'woocommerce_key' => 'woocommerce', 'woocommerce_secret' => 'woocommerce'
        ];

        $this->conn->beginTransaction();
        try {
            $sql = "INSERT INTO settings (setting_key, setting_value, setting_group) VALUES (?, ?, ?) 
                    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)";
            $stmt = $this->conn->prepare($sql);

            foreach ($data as $key => $value) {
                if (array_key_exists($key, $keyGroups)) {
                    $val = is_string($value) ? $value : (string)$value;
                    $stmt->execute([$key, $val, $keyGroups[$key]]);
                }
            }
            $this->conn->commit();
            Response::json(['success' => true, 'message' => 'Configuración actualizada']);
        } catch (\Exception $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    private function updateLegacy($data)
    {
        // 1. Check if table exists
        try {
            $this->conn->query("SELECT 1 FROM company_settings LIMIT 1");
        } catch (\Exception $e) {
            Response::error("Tabla company_settings no encontrada y settings no disponible.");
            return;
        }

        // 2. Get available columns to avoid "Unknown column" error
        $stmt = $this->conn->query("SHOW COLUMNS FROM company_settings");
        $existingColumns = $stmt->fetchAll(PDO::FETCH_COLUMN);

        // 3. Map frontend keys to DB columns
        $map = [
            'company_name' => 'company_name', // or business_name check below
            'company_ruc' => 'ruc',
            'company_address' => 'address',
            'company_phone' => 'phone',
            'company_email' => 'email',
            'company_logo' => 'logo_url',
            'woocommerce_url' => 'woocommerce_url',
            'woocommerce_key' => 'woocommerce_consumer_key',
            'woocommerce_secret' => 'woocommerce_consumer_secret',
            'smtp_host' => 'smtp_host',
            'smtp_port' => 'smtp_port',
            'smtp_user' => 'smtp_user',
            'smtp_pass' => 'smtp_password',
            'electronic_billing_enabled' => 'electronic_billing_enabled',
            'api_perudev_token' => 'api_perudev_token'
        ];

        // Handle alias for company_name if needed (legacy DBs might use business_name)
        if (!in_array('company_name', $existingColumns) && in_array('business_name', $existingColumns)) {
            $map['company_name'] = 'business_name';
        }

        // 4. Build data array only for existing columns
        $updateData = [];
        foreach ($map as $dataKey => $dbCol) {
            if (in_array($dbCol, $existingColumns) && isset($data[$dataKey])) {
                $updateData[$dbCol] = $data[$dataKey];
            }
        }

        if (empty($updateData)) {
            Response::json(['success' => true, 'message' => 'No hay datos compatibles para guardar.']);
            return;
        }

        // 5. Check if row exists
        $stmt = $this->conn->query("SELECT id FROM company_settings LIMIT 1");
        $id = $stmt->fetchColumn();

        if ($id) {
            $setParts = [];
            $values = [];
            foreach ($updateData as $col => $val) {
                $setParts[] = "$col = ?";
                $values[] = $val;
            }
            $values[] = $id;
            
            $sql = "UPDATE company_settings SET " . implode(', ', $setParts) . " WHERE id = ?";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($values);
        } else {
            $cols = implode(', ', array_keys($updateData));
            $placeholders = implode(', ', array_fill(0, count($updateData), '?'));
            $sql = "INSERT INTO company_settings ($cols) VALUES ($placeholders)";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute(array_values($updateData));
        }

        Response::json(['success' => true, 'message' => 'Configuración actualizada (Modo Legado)']);
    }

    public function testWooCommerce()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        // Simple stub for connection test
        if (isset($data['url']) && isset($data['key'])) {
             Response::json(['success' => true, 'message' => 'Conexión exitosa (Simulada)']);
        } else {
             Response::error("Faltan datos");
        }
    }

    public function uploadLogo()
    {
        try {
            if (!isset($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
                Response::error("No se ha subido ningún archivo o hubo un error.");
                return;
            }

            $file = $_FILES['logo'];
            $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            
            if (!in_array($file['type'], $allowedTypes)) {
                Response::error("Tipo de archivo no permitido. Solo imágenes (JPG, PNG, GIF, WEBP).");
                return;
            }

            // Create directory if not exists
            $uploadDir = __DIR__ . '/../../public/uploads/settings/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            // Generate unique filename
            $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
            $filename = 'logo_' . time() . '_' . uniqid() . '.' . $extension;
            $targetPath = $uploadDir . $filename;

            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                // Return the public URL
                // Assuming the API is served from the root of the 'api' folder
                $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
                $host = $_SERVER['HTTP_HOST'];
                $publicUrl = "$protocol://$host/public/uploads/settings/$filename";
                
                Response::json([
                    'success' => true, 
                    'message' => 'Logo subido correctamente',
                    'url' => $publicUrl
                ]);
            } else {
                Response::error("Error al mover el archivo subido.");
            }

        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }
}
