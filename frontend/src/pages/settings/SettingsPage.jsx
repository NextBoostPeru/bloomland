import React, { useState, useEffect } from 'react';
import { Settings, Building, CreditCard, ShoppingBag, Save, Mail, Upload } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  
  const [settings, setSettings] = useState({
    company_name: '',
    company_ruc: '',
    company_address: '',
    company_logo: '',
    company_phone: '',
    company_email: '',
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_pass: '',
    electronic_billing_enabled: '0',
    api_perudev_token: '',
    woocommerce_url: '',
    woocommerce_key: '',
    woocommerce_secret: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      // Merge with defaults to avoid nulls
      setSettings(prev => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
        toast.error('Ingresa un correo de destino');
        return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
        toast.error('Ingresa un correo válido');
        return;
    }

    setTestingEmail(true);
    const loadingToast = toast.loading('Enviando correo de prueba...');

    try {
        const response = await api.post('/settings/test-email', { email: testEmail });
        
        if (response.data.success) {
            toast.success(response.data.message || 'Correo enviado correctamente');
        } else {
            toast.error(response.data.message || 'Error al enviar correo');
        }
    } catch (error) {
        console.error('Error sending test email:', error);
        toast.error(error.response?.data?.message || 'Error al conectar con el servidor');
    } finally {
        setTestingEmail(false);
        toast.dismiss(loadingToast);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? '1' : '0') : value
    }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten imágenes');
        return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    const loadingToast = toast.loading('Subiendo logo...');

    try {
        const response = await api.post('/settings/logo', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        if (response.data.success) {
            setSettings(prev => ({ ...prev, company_logo: response.data.url }));
            toast.success('Logo subido correctamente');
        } else {
             toast.error(response.data.message || 'Error al subir logo');
        }
    } catch (error) {
        console.error(error);
        toast.error('Error al subir el logo');
    } finally {
        toast.dismiss(loadingToast);
    }
  };

  const tabs = [
    { id: 'company', label: 'Empresa', icon: Building },
    { id: 'billing', label: 'Facturación', icon: CreditCard },
    { id: 'woocommerce', label: 'WooCommerce', icon: ShoppingBag },
    { id: 'email', label: 'Correo SMTP', icon: Mail },
  ];

  return (
    <DashboardLayout title="Configuración del Sistema">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-slate-500">Parámetros globales de la aplicación</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save size={20} />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 flex flex-col gap-1 bg-white p-2 rounded-xl shadow-sm border border-slate-200 h-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Cargando configuración...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {activeTab === 'company' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Datos de la Empresa</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Comercial</label>
                    <input
                      type="text"
                      name="company_name"
                      value={settings.company_name}
                      onChange={handleChange}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">RUC</label>
                    <input
                      type="text"
                      name="company_ruc"
                      value={settings.company_ruc}
                      onChange={handleChange}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dirección Fiscal</label>
                    <input
                      type="text"
                      name="company_address"
                      value={settings.company_address}
                      onChange={handleChange}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                      <input
                        type="text"
                        name="company_phone"
                        value={settings.company_phone}
                        onChange={handleChange}
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        name="company_email"
                        value={settings.company_email}
                        onChange={handleChange}
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Logo de la Empresa</label>
                    <div className="flex items-center gap-4">
                        {settings.company_logo && (
                            <div className="w-16 h-16 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center relative group">
                                <img src={settings.company_logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                            </div>
                        )}
                        <div className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="w-full text-sm text-slate-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-indigo-50 file:text-indigo-700
                                hover:file:bg-indigo-100"
                            />
                            <p className="text-xs text-slate-500 mt-1">Recomendado: PNG o JPG. Se subirá automáticamente.</p>
                        </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'billing' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Facturación Electrónica</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      id="electronic_billing_enabled"
                      name="electronic_billing_enabled"
                      checked={settings.electronic_billing_enabled === '1'}
                      onChange={handleChange}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <label htmlFor="electronic_billing_enabled" className="text-sm font-medium text-slate-700">
                      Habilitar Facturación Electrónica
                    </label>
                  </div>
                  {settings.electronic_billing_enabled === '1' && (
                    <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
                      La integración con PSE/OSE requiere configuración adicional de certificados y endpoints.
                    </div>
                  )}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Token API PeruDev (Consultas DNI/RUC)</label>
                    <input
                      type="text"
                      name="api_perudev_token"
                      value={settings.api_perudev_token}
                      onChange={handleChange}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Pegar token aquí"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'woocommerce' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Integración WooCommerce</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">URL de la Tienda</label>
                    <input
                      type="url"
                      name="woocommerce_url"
                      value={settings.woocommerce_url}
                      onChange={handleChange}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="https://mitienda.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Consumer Key (CK)</label>
                    <input
                      type="text"
                      name="woocommerce_key"
                      value={settings.woocommerce_key}
                      onChange={handleChange}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Consumer Secret (CS)</label>
                    <input
                      type="password"
                      name="woocommerce_secret"
                      value={settings.woocommerce_secret}
                      onChange={handleChange}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'email' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Configuración SMTP</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Host SMTP</label>
                      <input
                        type="text"
                        name="smtp_host"
                        value={settings.smtp_host}
                        onChange={handleChange}
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Puerto</label>
                      <input
                        type="text"
                        name="smtp_port"
                        value={settings.smtp_port}
                        onChange={handleChange}
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Usuario SMTP</label>
                    <input
                      type="text"
                      name="smtp_user"
                      value={settings.smtp_user}
                      onChange={handleChange}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña SMTP</label>
                    <input
                      type="password"
                      name="smtp_pass"
                      value={settings.smtp_pass}
                      onChange={handleChange}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <div className="pt-4 border-t mt-4">
                    <h4 className="text-md font-medium text-slate-700 mb-3">Prueba de Configuración</h4>
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Correo de Prueba</label>
                            <input
                                type="email"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2"
                                placeholder="tu-correo@ejemplo.com"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={sendTestEmail}
                            disabled={testingEmail}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 h-[42px] min-w-[120px]"
                        >
                            {testingEmail ? 'Enviando...' : 'Enviar Prueba'}
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        Guarda los cambios antes de probar la configuración si has modificado los campos SMTP.
                    </p>
                  </div>
                </div>
              )}

            </form>
          )}
        </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
