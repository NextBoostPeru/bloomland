import React, { useState } from 'react';
import { Shield, Users, Lock, FileText } from 'lucide-react';
import UsersManagement from './UsersManagement';
import RolesManagement from './RolesManagement';
import AuditLogs from './AuditLogs';
import DashboardLayout from '../../layouts/DashboardLayout';

const SecurityPage = () => {
  const [activeTab, setActiveTab] = useState('users');

  const tabs = [
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'roles', label: 'Roles', icon: Shield },
    { id: 'audit', label: 'Auditoría', icon: FileText },
  ];

  return (
    <DashboardLayout title="Seguridad y Usuarios">
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-slate-600">
            Gestión de usuarios, roles, permisos y auditoría del sistema.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={18} />
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          {activeTab === 'users' && <UsersManagement />}
          {activeTab === 'roles' && <RolesManagement />}
          {activeTab === 'audit' && <AuditLogs />}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SecurityPage;
