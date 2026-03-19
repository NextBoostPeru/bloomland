import React, { useState, useEffect } from 'react';
import { Shield, Clock, Search, Monitor, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await api.get('/audit-logs');
      setLogs(response.data.data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    if (action.includes('CREATE')) return 'text-green-600 bg-green-50';
    if (action.includes('UPDATE')) return 'text-blue-600 bg-blue-50';
    if (action.includes('DELETE') || action.includes('DEACTIVATE')) return 'text-red-600 bg-red-50';
    return 'text-slate-600 bg-slate-50';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Auditoría de Accesos</h2>
          <p className="text-sm text-slate-500">Registro de actividades y cambios en el sistema</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-600">Fecha / Hora</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Usuario</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Acción</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Detalles</th>
              <th className="px-6 py-4 font-semibold text-slate-600">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="5" className="p-6 text-center">Cargando...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="5" className="p-6 text-center text-slate-500">No hay registros de auditoría</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-slate-400" />
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">
                      {log.first_name ? `${log.first_name} ${log.last_name_paternal}` : 'Sistema / Desconocido'}
                    </div>
                    <div className="text-xs text-slate-500">{log.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium font-mono ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={log.details}>
                    {log.details}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                    {log.ip_address || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogs;
