import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { 
  Save, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Globe, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard,
  ShoppingCart,
  Link as LinkIcon
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const InputField = ({ label, icon: Icon, type = "text", ...props }) => (
  <div className="group">
    <label className="block text-sm font-medium text-slate-700 mb-1.5 transition-colors group-focus-within:text-indigo-600">
      {label}
    </label>
    <div className="relative">
      {Icon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
          <Icon size={18} />
        </div>
      )}
      <input
        type={type}
        className={`w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 ${Icon ? 'pl-10' : 'pl-4'} pr-4 text-sm focus:border-indigo-500 focus:ring-indigo-500 focus:bg-white transition-all duration-200 shadow-sm hover:border-slate-300`}
        {...props}
      />
    </div>
  </div>
);

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  
  const [formData, setFormData] = useState({
    company_name: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    woocommerce_enabled: false,
    woocommerce_url: '',
    woocommerce_consumer_key: '',
    woocommerce_consumer_secret: '',
    api_perudev_token: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      
      // Ensure no null values for inputs
      const sanitizedData = Object.keys(data).reduce((acc, key) => {
        acc[key] = data[key] === null ? '' : data[key];
        return acc;
      }, {});

      // Convert 1/0 to boolean for checkbox
      sanitizedData.woocommerce_enabled = !!Number(sanitizedData.woocommerce_enabled);
      
      setFormData(sanitizedData);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/settings', formData);
      toast.success('Configuración guardada exitosamente');
      fetchSettings();
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!formData.woocommerce_url || !formData.woocommerce_consumer_key) {
      toast.error('Ingrese URL y Consumer Key para probar');
      return;
    }

    setTestingConnection(true);
    try {
      const { data } = await api.post('/settings/test-woo', {
        url: formData.woocommerce_url,
        key: formData.woocommerce_consumer_key,
        secret: formData.woocommerce_consumer_secret
      });
      
      if (data.success) {
        toast.success(data.message, { icon: '🎉' });
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error de conexión con WooCommerce');
    } finally {
      setTestingConnection(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Configuración">
        <div className="flex justify-center items-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="text-slate-500 font-medium animate-pulse">Cargando preferencias...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Configuración del Sistema">
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Preferencias Generales</h1>
            <p className="text-slate-500 mt-1">Administra la información de tu empresa y las integraciones externas.</p>
          </div>
          <button
            type="submit"
            form="settingsForm"
            disabled={saving}
            className="w-full md:w-auto bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-0.5"
          >
            {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
            <span className="font-medium">Guardar Cambios</span>
          </button>
        </div>

        <form id="settingsForm" onSubmit={handleSubmit} className="space-y-8">
          
          {/* Company Settings Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-300">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                <Building2 size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Datos de la Empresa</h2>
                <p className="text-sm text-slate-500">Información visible en reportes y comprobantes</p>
              </div>
            </div>
            
            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <InputField
                label="Nombre de Empresa / Razón Social"
                icon={Globe}
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                placeholder="Ej. Bloomland SAC"
                required
              />
              <InputField
                label="RUC"
                icon={CreditCard}
                name="ruc"
                value={formData.ruc}
                onChange={handleChange}
                placeholder="Ej. 20123456789"
              />
              <div className="col-span-1 md:col-span-2">
                <InputField
                  label="Dirección Fiscal"
                  icon={MapPin}
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Ej. Av. Principal 123, Lima"
                />
              </div>
              <InputField
                label="Teléfono / Celular"
                icon={Phone}
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ej. +51 999 888 777"
              />
              <InputField
                label="Email de Contacto"
                icon={Mail}
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="contacto@empresa.com"
              />
            </div>
          </div>

          {/* API PeruDev Integration */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-300">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                <Globe size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Integración Consulta RUC</h2>
                <p className="text-sm text-slate-500">Configuración de API PeruDev para consulta de datos</p>
              </div>
            </div>
            
            <div className="p-6 md:p-8">
               <div className="max-w-xl">
                <div className="group">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 transition-colors group-focus-within:text-emerald-600">
                      Token de API PeruDev
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <LinkIcon size={18} />
                      </div>
                      <input
                        type={showToken ? "text" : "password"}
                        name="api_perudev_token"
                        value={formData.api_perudev_token || ''}
                        onChange={handleChange}
                        placeholder="Ingrese su token de API PeruDev"
                        className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-10 pr-12 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:bg-white transition-all duration-200 shadow-sm hover:border-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Este token se utilizará para consultar datos de RUC/DNI automáticamente.
                    </p>
                </div>
               </div>
            </div>
          </div>

          {/* WooCommerce Integration Card */}
          <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${formData.woocommerce_enabled ? 'border-indigo-200 shadow-indigo-100 ring-1 ring-indigo-50' : 'border-slate-200'}`}>
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${formData.woocommerce_enabled ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                  <ShoppingCart size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Integración WooCommerce</h2>
                  <p className="text-sm text-slate-500">Sincroniza inventario y ventas con tu tienda online</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
                <span className={`text-sm font-semibold transition-colors ${formData.woocommerce_enabled ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {formData.woocommerce_enabled ? 'Activo' : 'Inactivo'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="woocommerce_enabled"
                    checked={formData.woocommerce_enabled}
                    onChange={handleChange}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            {/* Collapsible Content */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${formData.woocommerce_enabled ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-50'}`}>
              <div className="p-6 md:p-8 space-y-6">
                
                <div className="flex gap-3 p-4 bg-blue-50/80 text-blue-700 rounded-xl border border-blue-100 text-sm items-start">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <p>
                    Para conectar su tienda, vaya a <strong>WooCommerce &gt; Ajustes &gt; Avanzado &gt; API REST</strong> y cree una clave con permisos de <strong>Lectura/Escritura</strong>.
                  </p>
                </div>

                <div className="space-y-6">
                  <InputField
                    label="URL de la Tienda"
                    icon={LinkIcon}
                    type="url"
                    name="woocommerce_url"
                    value={formData.woocommerce_url}
                    onChange={handleChange}
                    placeholder="https://mitienda.com"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-700">Consumer Key</label>
                      <div className="relative group">
                        <input
                          type="text"
                          name="woocommerce_consumer_key"
                          value={formData.woocommerce_consumer_key}
                          onChange={handleChange}
                          placeholder="ck_..."
                          className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-4 pr-4 font-mono text-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all shadow-sm group-hover:border-slate-300"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-700">Consumer Secret</label>
                      <div className="relative group">
                        <input
                          type={showSecret ? "text" : "password"}
                          name="woocommerce_consumer_secret"
                          value={formData.woocommerce_consumer_secret}
                          onChange={handleChange}
                          placeholder={formData.woocommerce_consumer_secret === '********' ? '********' : 'cs_...'}
                          className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-4 pr-10 font-mono text-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all shadow-sm group-hover:border-slate-300"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors p-1"
                        >
                          {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={testConnection}
                    disabled={testingConnection || !formData.woocommerce_url}
                    className={`
                      flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all
                      ${testingConnection 
                        ? 'bg-slate-100 text-slate-500 cursor-wait' 
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:shadow-sm active:bg-indigo-200'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {testingConnection ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        Probar Conexión
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>
          </div>

        </form>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
