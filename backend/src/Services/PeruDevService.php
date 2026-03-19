<?php
namespace App\Services;

use App\Config\Database;
use PDO;

class PeruDevService {
    private $db;
    private $apiUrl = 'https://apiperu.dev/api';

    public function __construct() {
        $this->db = new Database();
    }

    private function getToken() {
        $conn = $this->db->connect();
        
        // Try settings table first (key-value)
        try {
            $stmt = $conn->query("SELECT setting_value FROM settings WHERE setting_key = 'api_perudev_token'");
            $token = $stmt->fetchColumn();
            if ($token) return $token;
        } catch (\Exception $e) {
            // Table might not exist, fallback to company_settings
        }

        try {
            $stmt = $conn->query("SELECT api_perudev_token FROM company_settings LIMIT 1");
            $token = $stmt->fetchColumn();
            return $token;
        } catch (\Exception $e) {
            return null;
        }
    }

    public function getRuc($ruc) {
        $token = $this->getToken();
        
        if (!$token) {
            return ['success' => false, 'message' => 'Token de API PeruDev no configurado'];
        }

        $ch = curl_init();
        
        // Ensure RUC is 11 digits
        if (strlen($ruc) !== 11) {
             return ['success' => false, 'message' => 'RUC debe tener 11 dígitos'];
        }

        $url = "{$this->apiUrl}/ruc/{$ruc}?api_token={$token}";

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // For local dev compatibility

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            return ['success' => false, 'message' => 'Error de conexión: ' . $error];
        }

        curl_close($ch);

        $data = json_decode($response, true);

        if ($httpCode === 200 && isset($data['success']) && $data['success']) {
            return [
                'success' => true,
                'data' => $data['data']
            ];
        } else {
            $msg = isset($data['message']) ? $data['message'] : 'Error al consultar RUC';
            return ['success' => false, 'message' => $msg];
        }
    }

    public function getDni($dni) {
        $token = $this->getToken();
        
        if (!$token) {
            return ['success' => false, 'message' => 'Token de API PeruDev no configurado'];
        }

        $ch = curl_init();
        
        // Ensure DNI is 8 digits
        if (strlen($dni) !== 8) {
             return ['success' => false, 'message' => 'DNI debe tener 8 dígitos'];
        }

        $url = "{$this->apiUrl}/dni/{$dni}?api_token={$token}";

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            return ['success' => false, 'message' => 'Error de conexión: ' . $error];
        }

        curl_close($ch);

        $data = json_decode($response, true);

        if ($httpCode === 200 && isset($data['success']) && $data['success']) {
            return [
                'success' => true,
                'data' => $data['data']
            ];
        } else {
            $msg = isset($data['message']) ? $data['message'] : 'Error al consultar DNI';
            return ['success' => false, 'message' => $msg];
        }
    }
}
