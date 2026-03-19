import React, { useState, useEffect } from 'react';
import { Shield, Edit, Trash2, Plus, Lock } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const RolesManagement = () => {
  const { user: currentUser } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await api.get('/roles');
      setRoles(response.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, current_user_id: currentUser?.id };
      
      if (editingId) {
        await api.put(`/roles/${editingId}`, payload);
      } else {
        await api.post('/roles', payload);
      }
      
      setShowModal(false);
      setEditingId(null);
      resetForm();
      fetchRoles();
    } catch (error) {
      console.error('Error saving role:', error);
      alert(error.response?.data?.message || 'Error al guardar rol');
    }
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`¿Estás seguro de eliminar el rol "${role.name}"?`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      fetchRoles();
    } catch (error) {
      console.error('Error deleting role:', error);
      alert(error.response?.data?.message || 'Error al eliminar rol');
    }
  };

  const handleEdit = (role) => {
    setEditingId(role.id);
    setFormData({
      name: role.name,
      description: role.description || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Gestión de Roles</h2>
          <p className="text-sm text-slate-500">Definición de roles y perfiles de acceso</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            resetForm();
            setShowModal(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
        >
          <Plus size={20} /> Nuevo Rol
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-600">ID</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Nombre del Rol</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Descripción</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="4" className="p-6 text-center">Cargando...</td></tr>
            ) : roles.length === 0 ? (
              <tr><td colSpan="4" className="p-6 text-center text-slate-500">No hay roles registrados</td></tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-500">#{role.id}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                      <Shield size={14} />
                      {role.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {role.description || '-'}
                  </td>
                  <td className="px-6 py-4 flex gap-2">
                    <button 
                      onClick={() => handleEdit(role)}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                      title="Editar"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(role)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">
              {editingId ? 'Editar Rol' : 'Nuevo Rol'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Rol</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="Ej. Vendedor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                  placeholder="Descripción de los permisos..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
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
                  Guardar Rol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesManagement;
