import { useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { Package, ArrowRightLeft, Store, Tag, Badge, Truck, Layers } from 'lucide-react';
import ProductTable from '../components/inventory/ProductTable';
import MovementHistory from '../components/inventory/MovementHistory';
import WarehouseManager from '../components/inventory/WarehouseManager';
import CategoryManager from '../components/inventory/CategoryManager';
import BrandManager from '../components/inventory/BrandManager';
import SupplierManager from '../components/inventory/SupplierManager';
import VariantsManager from '../components/inventory/VariantsManager';

const Inventory = () => {
  const [activeTab, setActiveTab] = useState('products');

  const tabs = [
    { id: 'products', label: 'Productos', icon: Package },
    { id: 'movements', label: 'Movimientos', icon: ArrowRightLeft },
    { id: 'warehouses', label: 'Sedes', icon: Store },
    { id: 'categories', label: 'Categorías', icon: Tag },
    { id: 'brands', label: 'Marcas', icon: Badge },
    { id: 'variants', label: 'Variantes', icon: Layers },
    { id: 'suppliers', label: 'Proveedores', icon: Truck },
  ];

  return (
    <DashboardLayout title="Gestión de Inventario">
      <div className="flex flex-col gap-6">
        
        {/* Tabs Header */}
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex gap-2 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[500px]">
           {activeTab === 'products' && <ProductTable />}
           {activeTab === 'movements' && <MovementHistory />}
           {activeTab === 'warehouses' && <WarehouseManager />}
           {activeTab === 'categories' && <CategoryManager />}
           {activeTab === 'brands' && <BrandManager />}
           {activeTab === 'variants' && <VariantsManager />}
           {activeTab === 'suppliers' && <SupplierManager />}
        </div>

      </div>
    </DashboardLayout>
  );
};

export default Inventory;
