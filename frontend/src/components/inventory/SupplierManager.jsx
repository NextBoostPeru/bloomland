import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Plus, Truck, Edit, Trash, Phone, Mail, MapPin, FileText, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const SupplierManager = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [searchingRuc, setSearchingRuc] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    contact_name: '', 
    email: '', 
    phone: '', 
    address: '', 
    ruc: '' 
  });

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/suppliers');
      setSuppliers(data);
    } catch (error) {
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
      resetForm();
      fetchSuppliers();
    } catch (error) {
      toast.error('Error al guardar proveedor');
    }
  };

  const handleEdit = (supplier) => {
    setFormData({ 
      name: supplier.name, 
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      ruc: supplier.ruc || ''
    });
    setEditingId(supplier.id);
    setShowModal(true);
  };

  const handleDelete = (supplier) => {
    setItemToDelete(supplier);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await api.delete(`/suppliers/${itemToDelete.id}`);
      toast.success('Proveedor eliminado');
      fetchSuppliers();
      setItemToDelete(null);
    } catch (error) {
      toast.error('Error al eliminar proveedor');
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      contact_name: '', 
      email: '', 
      phone: '', 
      address: '', 
      ruc: '' 
    });
    setEditingId(null);
  };

  const handleClose = () => {
    setShowModal(false);
    resetForm();
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
          // If apiperu.dev returns these fields (depends on plan/response structure)
          // contact_name: '', 
          // phone: '',
          // email: '' 
        }));
        toast.success('Datos encontrados');
      }
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.error || 'Error al consultar RUC';
      toast.error(msg);
    } finally {
      setSearchingRuc(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Gestión de Proveedores</h2>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <Plus size={18} />
          <span>Nuevo Proveedor</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando proveedores...</div>
        ) : suppliers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No hay proveedores registrados</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">Empresa</th>
                <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">RUC</th>
                <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">Contacto</th>
                <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">Teléfono</th>
                <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Truck size={18} />
                      </div>
                      <div>
                        <span className="font-medium text-slate-700 block">{supplier.name}</span>
                        {supplier.email && <span className="text-xs text-slate-400 flex items-center gap-1"><Mail size={12}/> {supplier.email}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {supplier.ruc || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {supplier.contact_name || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {supplier.phone ? (
                        <div className="flex items-center gap-1">
                            <Phone size={14} className="text-slate-400"/>
                            <span>{supplier.phone}</span>
                        </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(supplier)} 
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(supplier)} 
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">{editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
                <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">&times;</button>
             </div>
             <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">RUC</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={formData.ruc}
                          onChange={(e) => setFormData({...formData, ruc: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
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
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Empresa / Razón Social</label>
                      <input 
                        required
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Contacto</label>
                      <input 
                        type="text" 
                        value={formData.contact_name}
                        onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                      <input 
                        type="text" 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input 
                        type="email" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                      <input 
                        type="text" 
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={handleClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Guardar</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 border border-slate-100">
                <h4 className="text-lg font-bold text-slate-800 mb-2">¿Eliminar proveedor?</h4>
                <p className="text-slate-600 mb-6">
                    Estás a punto de eliminar <span className="font-semibold text-slate-800">"{itemToDelete.name}"</span>. Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => setItemToDelete(null)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmDelete}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm shadow-red-200 transition-colors"
                    >
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default SupplierManager;
