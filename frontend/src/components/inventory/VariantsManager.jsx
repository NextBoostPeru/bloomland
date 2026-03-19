import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Layers, Edit, Trash, Plus, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const attributes = [
  { slug: 'talla', label: 'Tallas', description: 'Valores de talla usados en las variaciones.' },
  { slug: 'color', label: 'Colores', description: 'Valores de color usados en las variaciones.' },
  { slug: 'diseno', label: 'Diseños', description: 'Valores de diseño usados en las variaciones.' }
];

const VariantsManager = () => {
  const [terms, setTerms] = useState({ talla: [], color: [], diseno: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newNames, setNewNames] = useState({ talla: '', color: '', diseno: '' });
  const [editing, setEditing] = useState({ attr: null, id: null });
  const [editName, setEditName] = useState('');

  const fetchTerms = async () => {
    try {
      if (loading || saving) return;
      setLoading(true);
      const [tRes, cRes, dRes] = await Promise.all([
        api.get('/inventory/attributes/talla/terms'),
        api.get('/inventory/attributes/color/terms'),
        api.get('/inventory/attributes/diseno/terms')
      ]);
      const normalize = (res) => (res?.data?.success ? res.data.data || [] : []);
      setTerms({
        talla: normalize(tRes),
        color: normalize(cRes),
        diseno: normalize(dRes)
      });
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar variantes desde WooCommerce');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, []);

  const handleAdd = async (slug) => {
    if (saving || loading) return;
    const name = newNames[slug].trim();
    if (!name) {
      toast.error('El nombre es obligatorio');
      return;
    }
    try {
      setSaving(true);
      const { data } = await api.post(`/inventory/attributes/${slug}/terms`, { name });
      if (!data?.success) {
        throw new Error(data?.message || 'Error al crear valor');
      }
      setNewNames({ ...newNames, [slug]: '' });
      await fetchTerms();
      toast.success('Valor creado');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Error al crear valor');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (slug, term) => {
    if (saving) return;
    setEditing({ attr: slug, id: term.id });
    setEditName(term.name);
  };

  const handleUpdate = async (slug, id) => {
    if (saving) return;
    const name = editName.trim();
    if (!name) {
      toast.error('El nombre es obligatorio');
      return;
    }
    try {
      setSaving(true);
      const { data } = await api.put(`/inventory/attributes/${slug}/terms/${id}`, { name });
      if (!data?.success) {
        throw new Error(data?.message || 'Error al actualizar valor');
      }
      setEditing({ attr: null, id: null });
      setEditName('');
      await fetchTerms();
      toast.success('Valor actualizado');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Error al actualizar valor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slug, term) => {
    if (saving) return;
    const confirmed = window.confirm(`¿Eliminar "${term.name}" de ${slug}?`);
    if (!confirmed) return;
    try {
      setSaving(true);
      const { data } = await api.delete(`/inventory/attributes/${slug}/terms/${term.id}`);
      if (!data?.success) {
        throw new Error(data?.message || 'Error al eliminar valor');
      }
      await fetchTerms();
      toast.success('Valor eliminado');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Error al eliminar valor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Layers size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Gestión de Variantes</h2>
            <p className="text-sm text-slate-500">
              Administra los valores de Talla, Color y Diseño sincronizados con WooCommerce.
            </p>
          </div>
        </div>
        <button
          onClick={fetchTerms}
          disabled={loading || saving}
          className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw size={18} className={loading || saving ? 'animate-spin' : ''} />
          <span>Refrescar</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {attributes.map((attr) => (
          <div key={attr.slug} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{attr.label}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{attr.description}</p>
              </div>
            </div>
            {loading ? (
              <div className="p-6 text-center text-slate-500 text-sm">Cargando valores...</div>
            ) : terms[attr.slug].length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No hay valores registrados para {attr.label.toLowerCase()}.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      Nombre
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {terms[attr.slug].map((term) => (
                    <tr key={term.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-2">
                        {editing.attr === attr.slug && editing.id === term.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded-lg text-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="text-slate-700">{term.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {editing.attr === attr.slug && editing.id === term.id ? (
                            <>
                              <button
                                onClick={() => handleUpdate(attr.slug, term.id)}
                                disabled={saving}
                                className="px-2 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => {
                                  if (saving) return;
                                  setEditing({ attr: null, id: null });
                                  setEditName('');
                                }}
                                disabled={saving}
                                className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(attr.slug, term)}
                                disabled={saving}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(attr.slug, term)}
                                disabled={saving}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <Trash size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
              <input
                type="text"
                placeholder={`Nuevo ${attr.label.slice(0, -1).toLowerCase()}...`}
                value={newNames[attr.slug]}
                onChange={(e) => setNewNames({ ...newNames, [attr.slug]: e.target.value })}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
              <button
                onClick={() => handleAdd(attr.slug)}
                disabled={saving || loading}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
                <span>Agregar</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VariantsManager;
