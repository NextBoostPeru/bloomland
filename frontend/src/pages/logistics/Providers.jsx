import React, { useState, useEffect } from 'react';
import { Truck, Edit, Trash2, Plus, Globe, Phone, Search, Loader2 } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const Providers = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchingRuc, setSearchingRuc] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    ruc: '',
    contact_info: '',
    website_url: ''
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const { data } = await api.get('/logistics/providers');
      setProviders(data);
    } catch (error) {
      console.error('Error fetching providers:', error);
      toast.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const handleRucSearch = async () => {
    if (!formData.ruc || formData.ruc.length !== 11) {
      toast.error('Ingrese un RUC válido de 11 dígitos');
      return;
    }

    setSearchingRuc(true);
    try {
      const { data } = await api.get(`/external/ruc/${formData.ruc}`);
      
      if (data) {
        console.log('RUC Data:', data); // Debugging
        setFormData(prev => ({
          ...prev,
          name: data.razon_social || data.nombre_o_razon_social || data.nombre || '',
          // address is not in logistics providers schema yet, but name is key
        }));
        toast.success('Datos encontrados en SUNAT');
      }
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.error || 'Error al consultar RUC';
      toast.error(msg);
    } finally {
      setSearchingRuc(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/logistics/providers/${editingId}`, formData);
        toast.success('Proveedor actualizado');
      } else {
        await api.post('/logistics/providers', formData);
        toast.success('Proveedor creado');
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', ruc: '', contact_info: '', website_url: '' });
      fetchProviders();
    } catch (error) {
      console.error('Error saving provider:', error);
      toast.error('Error al guardar proveedor');
    }
  };

  const handleEdit = (provider) => {
    setEditingId(provider.id);
    setFormData({
      name: provider.name,
      ruc: provider.ruc,
      contact_info: provider.contact_info,
      website_url: provider.website_url
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proveedor logístico?')) return;
    try {
      await api.delete(`/logistics/providers/${id}`);
      fetchProviders();
      toast.success('Proveedor eliminado');
    } catch (error) {
      console.error('Error deleting provider:', error);
      toast.error('Error al eliminar proveedor');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Proveedores Logísticos</h2>
          <p className="text-sm text-slate-500">Gestión de agencias de transporte y couriers</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', ruc: '', contact_info: '', website_url: '' });
            setShowModal(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
        >
          <Plus size={20} /> Nuevo Proveedor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-10">Cargando...</div>
        ) : providers.map((provider) => (
          <div key={provider.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{provider.name}</h3>
                  {provider.ruc && <p className="text-xs text-slate-500">RUC: {provider.ruc}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleEdit(provider)}
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                >
                  <Edit size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(provider.id)}
                  className="p-1 text-slate-400 hover:text-red-600 rounded"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <div className="space-y-3 text-sm text-slate-600">
              {provider.contact_info && (
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-slate-400" />
                  <span>{provider.contact_info}</span>
                </div>
              )}
              {provider.website_url && (
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-slate-400" />
                  <a href={provider.website_url.startsWith('http') ? provider.website_url : `https://${provider.website_url}`} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="text-indigo-600 hover:underline"
                  >
                    {provider.website_url}
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">
              {editingId ? 'Editar Proveedor' : 'Nuevo Proveedor Logístico'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre (Empresa)</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contacto / Teléfono</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.contact_info}
                  onChange={(e) => setFormData({...formData, contact_info: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sitio Web</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.website_url}
                  onChange={(e) => setFormData({...formData, website_url: e.target.value})}
                  placeholder="www.ejemplo.com"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Providers;
