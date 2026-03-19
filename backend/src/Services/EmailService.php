<?php

namespace App\Services;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use App\Config\Database;
use PDO;
use Dotenv\Dotenv;

class EmailService
{
    private $mailer;
    private $conn;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
        
        $this->mailer = new PHPMailer(true);
        $this->configureMailer();
    }

    private function configureMailer()
    {
        // Try to get settings from DB
        $settings = $this->getSettingsFromDB();

        // Server settings
        $this->mailer->isSMTP();
        $this->mailer->Host       = $settings['smtp_host'] ?? $_ENV['SMTP_HOST'] ?? 'smtp.gmail.com';
        $this->mailer->SMTPAuth   = true;
        $this->mailer->Username   = $settings['smtp_user'] ?? $_ENV['SMTP_USER'] ?? '';
        $this->mailer->Password   = $settings['smtp_pass'] ?? $_ENV['SMTP_PASS'] ?? '';
        $this->mailer->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $this->mailer->Port       = $settings['smtp_port'] ?? $_ENV['SMTP_PORT'] ?? 587;
        
        // Default sender
        $fromEmail = $settings['smtp_user'] ?? $_ENV['SMTP_FROM_EMAIL'] ?? $_ENV['SMTP_USER'] ?? 'noreply@example.com';
        $fromName = $settings['company_name'] ?? $_ENV['SMTP_FROM_NAME'] ?? 'BabyLand ERP';
        
        $this->mailer->setFrom($fromEmail, $fromName);
        $this->mailer->isHTML(true);
        $this->mailer->CharSet = 'UTF-8';
        $this->mailer->Timeout = 10; // 10 seconds timeout
    }

    private function getSettingsFromDB()
    {
        try {
            // Check for KV settings table first
            $stmt = $this->conn->query("SELECT setting_key, setting_value FROM settings");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if ($rows) {
                $settings = [];
                foreach ($rows as $row) {
                    $settings[$row['setting_key']] = $row['setting_value'];
                }
                return $settings;
            }

            // Fallback to legacy company_settings table
            $stmt = $this->conn->query("SELECT * FROM company_settings LIMIT 1");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                return [
                    'smtp_host' => $row['smtp_host'] ?? '',
                    'smtp_port' => $row['smtp_port'] ?? '',
                    'smtp_user' => $row['smtp_user'] ?? '',
                    'smtp_pass' => $row['smtp_password'] ?? '',
                    'company_name' => $row['company_name'] ?? $row['business_name'] ?? ''
                ];
            }
        } catch (\Exception $e) {
            // Silently fail and fallback to env
        }

        return [];
    }

    public function sendPasswordReset($email, $token)
    {
        try {
            $resetLink = ($_ENV['FRONTEND_URL'] ?? 'http://localhost:5173') . "/reset-password?token=" . $token . "&email=" . urlencode($email);

            $this->mailer->addAddress($email);
            $this->mailer->Subject = 'Recuperación de Contraseña - BabyLand ERP';
            $this->mailer->Body    = "
                <h1>Recuperación de Contraseña</h1>
                <p>Has solicitado restablecer tu contraseña.</p>
                <p>Haz clic en el siguiente enlace para continuar:</p>
                <p><a href='{$resetLink}'>Restablecer Contraseña</a></p>
                <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                <p>Este enlace expirará en 1 hora.</p>
            ";
            $this->mailer->AltBody = "Has solicitado restablecer tu contraseña. Visita el siguiente enlace: $resetLink";

            $this->mailer->send();
            return true;
        } catch (Exception $e) {
            // Log error if needed: error_log($this->mailer->ErrorInfo);
            return false;
        }
    }

    public function sendTestEmail($toEmail)
    {
        try {
            $this->mailer->addAddress($toEmail);
            $this->mailer->Subject = 'Prueba de Configuración SMTP - BabyLand ERP';
            $this->mailer->Body    = "
                <h1>Correo de Prueba</h1>
                <p>Si estás recibiendo este mensaje, significa que la configuración SMTP de tu sistema BabyLand ERP es correcta.</p>
                <p>Fecha y hora: " . date('Y-m-d H:i:s') . "</p>
            ";
            $this->mailer->AltBody = "Si recibes este mensaje, la configuración SMTP es correcta.";

            $this->mailer->send();
            return ['success' => true, 'message' => 'Correo enviado correctamente'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $this->mailer->ErrorInfo];
        }
    }
}
