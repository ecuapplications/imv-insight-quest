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
  const [activeTab, setActiveTab] = useState("stats");

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
    <div className="min-h-screen bg-[hsl(var(--kanban-bg))]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] bg-clip-text text-transparent">
              IMV Health Digestive
            </h1>
            <p className="text-sm text-[hsl(var(--imv-gray))]">Panel de Administración de Encuestas</p>
          </div>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-white">
            <TabsTrigger value="stats" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--imv-cyan))] data-[state=active]:to-[hsl(var(--imv-purple))] data-[state=active]:text-black">
              <BarChart3 className="mr-2 h-4 w-4" />
              Estadísticas
            </TabsTrigger>
            <TabsTrigger value="kanban" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--imv-cyan))] data-[state=active]:to-[hsl(var(--imv-purple))] data-[state=active]:text-black">
              <Kanban className="mr-2 h-4 w-4" />
              Gestión de Comentarios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="space-y-6">
            <StatsTab />
          </TabsContent>

          <TabsContent value="kanban" className="space-y-6">
            <KanbanTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
