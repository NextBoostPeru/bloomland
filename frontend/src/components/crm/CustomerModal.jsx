import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, DollarSign, Search } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function CustomerModal({ customer, onClose, onSuccess }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    document_type: 'DNI',
    document_number: '',
    email: '',
    phone: '',
    address: '',
    credit_limit: 0
  });
  const [loading, setLoading] = useState(false);
  const [searchingDoc, setSearchingDoc] = useState(false);
  const [error, setError] = useState(null);

  const canManageCredit = ['Administrador', 'Supervisor'].includes(user?.role);

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.first_name || customer.name || '',
        document_type: customer.doc_type || customer.document_type || 'DNI',
        document_number: customer.doc_number || customer.document_number || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        credit_limit: customer.credit_limit || 0
      });
    }
  }, [customer]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSearchDocument = async () => {
    if (!formData.document_number) {
      toast.error('Ingrese un número de documento');
      return;
    }

    setSearchingDoc(true);
    try {
      let endpoint = '';
      if (formData.document_type === 'DNI') {
        if (formData.document_number.length !== 8) {
           toast.error('El DNI debe tener 8 dígitos');
           setSearchingDoc(false);
           return;
        }
        endpoint = `/external/dni/${formData.document_number}`;
      } else if (formData.document_type === 'RUC') {
        if (formData.document_number.length !== 11) {
           toast.error('El RUC debe tener 11 dígitos');
           setSearchingDoc(false);
           return;
        }
        endpoint = `/external/ruc/${formData.document_number}`;
      } else {
        toast.error('Búsqueda no disponible para este tipo de documento');
        setSearchingDoc(false);
        return;
      }

      const response = await api.get(endpoint);
      const data = response.data;

      if (formData.document_type === 'DNI') {
        setFormData(prev => ({
          ...prev,
          name: `${data.nombres} ${data.apellido_paterno} ${data.apellido_materno}`,
          // Keep existing address if empty or update? Usually DNI doesn't give address, RUC does.
        }));
      } else if (formData.document_type === 'RUC') {
        setFormData(prev => ({
          ...prev,
          name: data.nombre_o_razon_social,
          address: data.direccion_completa || prev.address
        }));
      }
      
      toast.success('Datos encontrados');
    } catch (error) {
      console.error(error);
      toast.error('No se encontraron datos o hubo un error');
    } finally {
      setSearchingDoc(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (customer) {
        await api.put(`/clientes/${customer.id}`, formData);
        toast.success('Cliente actualizado correctamente');
      } else {
        await api.post('/clientes', formData);
        toast.success('Cliente registrado correctamente');
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.response?.data?.error || 'Error al guardar cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">
            {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Tipo Documento</label>
              <select
                name="document_type"
                value={formData.document_type}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="DNI">DNI</option>
                <option value="RUC">RUC</option>
                <option value="CE">Carnet Extranjería</option>
                <option value="PASAPORTE">Pasaporte</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Número Documento</label>
              <div className="relative">
                <input
                  type="text"
                  name="document_number"
                  value={formData.document_number}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={handleSearchDocument}
                  disabled={searchingDoc || !['DNI', 'RUC'].includes(formData.document_type)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Buscar en RENIEC/SUNAT"
                >
                  <Search className={`w-5 h-5 ${searchingDoc ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Nombre Completo / Razón Social</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Ej: Juan Pérez"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="cliente@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Teléfono</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="999 999 999"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Dirección</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Av. Principal 123"
              />
            </div>

            {canManageCredit && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Límite de Crédito</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    name="credit_limit"
                    value={formData.credit_limit}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors mr-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  );
}
