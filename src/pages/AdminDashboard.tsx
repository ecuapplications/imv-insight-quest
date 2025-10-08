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
  const [activeTab, setActiveTab] = useState("kanban");

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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Forzamos una recarga completa a la página de login.
      // Esto limpia todo el estado de la aplicación y evita la redirección no deseada.
      window.location.href = '/admin-login';

    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-screen bg-[hsl(var(--kanban-bg))] flex flex-col">
      <div className="flex-grow">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div>
              <img 
                src="/logo.png" 
                alt="Logotipo de IMV Health Digestive" 
                className="h-16 w-auto"
              />
              <p className="text-sm text-[hsl(var(--imv-gray))] mt-1">Panel de Administración de Encuestas</p>
            </div>
            <TabsList className="p-1 h-auto bg-gray-100 rounded-lg">
              <TabsTrigger 
                value="stats" 
                className="px-4 py-2 text-muted-foreground rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--imv-cyan))] data-[state=active]:to-[hsl(var(--imv-purple))] data-[state=active]:text-black data-[state=active]:shadow-md data-[state=active]:font-semibold"
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Estadísticas
              </TabsTrigger>
              <TabsTrigger 
                value="kanban" 
                className="px-4 py-2 text-muted-foreground rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--imv-cyan))] data-[state=active]:to-[hsl(var(--imv-purple))] data-[state=active]:text-black data-[state=active]:shadow-md data-[state=active]:font-semibold"
              >
                <Kanban className="mr-2 h-4 w-4" />
                Gestión de Comentarios
              </TabsTrigger>
            </TabsList>
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
          <TabsContent value="stats" className="space-y-6">
            <StatsTab />
          </TabsContent>
          <TabsContent value="kanban" className="space-y-6">
            <KanbanTab />
          </TabsContent>
        </div>
      </div>

      {/* --- FOOTER AÑADIDO AQUÍ --- */}
      <footer className="text-center py-4 text-xs text-gray-500">
        Desarrollado para IMVhealth / para soporte técnico{" "}
        <a 
          href="http://wa.me/13164695701" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="hover:underline text-cyan-600"
        >
          contactar por WhatsApp
        </a>
      </footer>
    </Tabs>
  );
};

export default AdminDashboard;