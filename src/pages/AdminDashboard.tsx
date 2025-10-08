import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, BarChart3, Kanban } from "lucide-react";
import StatsTab from "@/components/admin/StatsTab";
import KanbanTab from "@/components/admin/KanbanTab";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("kanban"); // Cambiado a 'kanban' por defecto

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin-login");
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Sesión cerrada");
      navigate("/admin-login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    // 1. El componente <Tabs> ahora envuelve toda la página
    <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-screen bg-[hsl(var(--kanban-bg))]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          {/* Logo y Título */}
<div>
  <img 
    src="/logo.png" 
    alt="Logotipo de IMV Health Digestive" 
    className="h-16 w-auto" // Ajustado a h-16 como pediste
  />
  <p className="text-sm text-[hsl(var(--imv-gray))] mt-1">Panel de Administración de Encuestas</p>
</div>

          {/* 2. La lista de pestañas (TabsList) se ha movido aquí */}
          <TabsList className="bg-white">
            <TabsTrigger value="stats" className="data-[state=active]:bg-gray-100 data-[state=active]:text-gray-800">
              <BarChart3 className="mr-2 h-4 w-4" />
              Estadísticas
            </TabsTrigger>
            <TabsTrigger value="kanban" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--imv-cyan))] data-[state=active]:to-[hsl(var(--imv-purple))] data-[state=active]:text-black">
              <Kanban className="mr-2 h-4 w-4" />
              Gestión de Comentarios
            </TabsTrigger>
          </TabsList>

          {/* Botón de Cerrar Sesión */}
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-gray-300 hover:bg-gray-100"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* 3. El contenido de las pestañas (<TabsContent>) permanece aquí */}
        <TabsContent value="stats" className="space-y-6">
          <StatsTab />
        </TabsContent>

        <TabsContent value="kanban" className="space-y-6">
          <KanbanTab />
        </TabsContent>
      </div>
    </Tabs>
  );
};

export default AdminDashboard;