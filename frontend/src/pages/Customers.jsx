import React from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import CustomerList from '../components/crm/CustomerList';

export default function Customers() {
  return (
    <DashboardLayout title="Gestión de Clientes">
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <p className="text-slate-500">Administra la base de datos de clientes y su historial de compras.</p>
        </div>
        
        <CustomerList />
      </div>
    </DashboardLayout>
  );
}
