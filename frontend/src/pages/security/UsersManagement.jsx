import React, { useState, useEffect } from 'react';
import { Users, Edit, Trash2, Plus, Shield, UserX, UserCheck } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const UsersManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role_id: '',
    first_name: '',
    last_name_paternal: '',
    last_name_maternal: '',
    doc_type: 'DNI',
    doc_number: '',
    active: 1
  });

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await api.get('/roles');
      setRoles(response.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, current_user_id: currentUser?.id };
      
      if (editingId) {
        if (!payload.password) delete payload.password; // Don't update password if empty
        await api.put(`/users/${editingId}`, payload);
      } else {
        await api.post('/users', payload);
      }
      
      setShowModal(false);
      setEditingId(null);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      alert(error.response?.data?.message || 'Error al guardar usuario');
    }
  };

  const handleToggleStatus = async (user) => {
    if (!window.confirm(`¿${user.active ? 'Desactivar' : 'Activar'} este usuario?`)) return;
    try {
      // Using update endpoint to toggle status
      await api.put(`/users/${user.id}`, {
        ...user,
        active: user.active ? 0 : 1,
        current_user_id: currentUser?.id
      });
      fetchUsers();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setFormData({
      email: user.email,
      password: '', // Always empty on edit
      role_id: user.role_id,
      first_name: user.first_name,
      last_name_paternal: user.last_name_paternal,
      last_name_maternal: user.last_name_maternal || '',
      doc_type: user.doc_type || 'DNI', // Assuming backend returns this if not added to select
      doc_number: user.doc_number,
      active: user.active
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      role_id: '',
      first_name: '',
      last_name_paternal: '',
      last_name_maternal: '',
      doc_type: 'DNI',
      doc_number: '',
      active: 1
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Gestión de Usuarios</h2>
          <p className="text-sm text-slate-500">Administración de cuentas y roles</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            resetForm();
            setShowModal(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
        >
          <Plus size={20} /> Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-600">Usuario</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Rol</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Documento</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Estado</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="5" className="p-6 text-center">Cargando...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="5" className="p-6 text-center text-slate-500">No hay usuarios registrados</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">
                      {u.first_name} {u.last_name_paternal}
                    </div>
                    <div className="text-sm text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      <Shield size={12} />
                      {u.role_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {u.doc_number}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex gap-2">
                    <button 
                      onClick={() => handleEdit(u)}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                      title="Editar"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleToggleStatus(u)}
                      className={`p-1 rounded ${u.active ? 'text-slate-400 hover:text-red-600' : 'text-slate-400 hover:text-green-600'}`}
                      title={u.active ? 'Desactivar' : 'Activar'}
                    >
                      {u.active ? <UserX size={18} /> : <UserCheck size={18} />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Apellido Paterno</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.last_name_paternal}
                    onChange={(e) => setFormData({...formData, last_name_paternal: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Apellido Materno</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.last_name_maternal}
                    onChange={(e) => setFormData({...formData, last_name_maternal: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.role_id}
                    onChange={(e) => setFormData({...formData, role_id: e.target.value})}
                    required
                  >
                    <option value="">Seleccionar Rol</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Doc.</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.doc_type}
                    onChange={(e) => setFormData({...formData, doc_type: e.target.value})}
                  >
                    <option value="DNI">DNI</option>
                    <option value="CE">CE</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">N° Documento</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.doc_number}
                    onChange={(e) => setFormData({...formData, doc_number: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email / Usuario</label>
                  <input
                    type="email"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contraseña {editingId && '(Dejar en blanco para mantener)'}
                  </label>
                  <input
                    type="password"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required={!editingId}
                    minLength={6}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 mt-4">
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
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;
