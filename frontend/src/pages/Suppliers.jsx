import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Truck, Loader2 } from 'lucide-react';
import api from '../services/api';
import DashboardLayout from '../layouts/DashboardLayout';
import toast from 'react-hot-toast';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [searchingRuc, setSearchingRuc] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    ruc: '',
    contact_name: '',
    phone: '',
    email: '',
    address: ''
  });

  const fetchSuppliers = async () => {
    try {
      const { data } = await api.get('/suppliers');
      setSuppliers(data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/suppliers/${editingId}`, formData);
        toast.success('Proveedor actualizado');
      } else {
        await api.post('/suppliers', formData);
        toast.success('Proveedor creado');
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', ruc: '', contact_name: '', phone: '', email: '', address: '' });
      fetchSuppliers();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error('Error al guardar proveedor');
    }
  };

  const handleEdit = (supplier) => {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.business_name || supplier.name, 
      ruc: supplier.ruc || '',
      contact_name: supplier.contact_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proveedor?')) return;
    try {
      await api.delete(`/suppliers/${id}`);
      toast.success('Proveedor eliminado');
      fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast.error('Error al eliminar proveedor');
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
          address: data.direccion_completa || data.direccion || data.domicilio_fiscal || '',
          // apiperu.dev fields if available
          // contact_name: '', 
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

  const filteredSuppliers = suppliers.filter(s => 
    (s.business_name || s.name).toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.ruc?.includes(searchTerm)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Proveedores</h1>
            <p className="text-slate-500">Gestión de proveedores y contactos</p>
          </div>
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', ruc: '', contact_name: '', phone: '', email: '', address: '' });
              setShowModal(true);
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200"
          >
            <Plus size={20} /> Nuevo Proveedor
          </button>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="Buscar por nombre o RUC..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-600">Empresa</th>
                <th className="px-6 py-4 font-semibold text-slate-600">RUC</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Contacto</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Teléfono / Email</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="5" className="p-6 text-center">Cargando...</td></tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr><td colSpan="5" className="p-6 text-center text-slate-500">No se encontraron proveedores</td></tr>
              ) : (
                filteredSuppliers.map(supplier => (
                  <tr key={supplier.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                          <Truck size={20} />
                        </div>
                        <span className="font-medium text-slate-800">{supplier.business_name || supplier.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{supplier.ruc}</td>
                    <td className="px-6 py-4 text-slate-600">{supplier.contact_name || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600">{supplier.phone}</div>
                      <div className="text-xs text-slate-400">{supplier.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(supplier)} className="text-blue-500 hover:text-blue-700">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(supplier.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">{editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">RUC</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" required
                      className="w-full border border-slate-300 rounded-lg p-2"
                      value={formData.ruc}
                      onChange={e => setFormData({...formData, ruc: e.target.value})}
                      maxLength={11}
                    />
                    <button
                      type="button"
                      onClick={handleRucSearch}
                      disabled={searchingRuc || !formData.ruc}
                      className="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Consultar RUC"
                    >
                      {searchingRuc ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Razón Social</label>
                  <input 
                    type="text" required
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contacto</label>
                    <input 
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2"
                      value={formData.contact_name}
                      onChange={e => setFormData({...formData, contact_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                    <input 
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input 
                    type="email"
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                  <input 
                    type="text"
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div className="flex justify-end gap-2 mt-6">
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
    </DashboardLayout>
  );
};

export default Suppliers;
