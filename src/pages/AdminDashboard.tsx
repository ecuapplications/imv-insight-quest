import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, BarChart3, Kanban, Tag, ShieldAlert } from "lucide-react";
import StatsTab from "@/components/admin/StatsTab";
import KanbanTab from "@/components/admin/KanbanTab";
import TagsManagementTab from "@/components/admin/TagsManagementTab";
import SuspiciousDevicesTab from "@/components/admin/SuspiciousDevicesTab";
import { logout, isAuthenticated } from "@/lib/api";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("kanban");

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin-login");
    }
  }, [navigate]);

  const handleLogout = () => {
    logout();
    window.location.href = '/admin-login';
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
              <TabsTrigger
                value="tags"
                className="px-4 py-2 text-muted-foreground rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--imv-cyan))] data-[state=active]:to-[hsl(var(--imv-purple))] data-[state=active]:text-black data-[state=active]:shadow-md data-[state=active]:font-semibold"
              >
                <Tag className="mr-2 h-4 w-4" />
                Gestión de Etiquetas
              </TabsTrigger>
              <TabsTrigger
                value="sospechosos"
                className="px-4 py-2 text-muted-foreground rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--imv-cyan))] data-[state=active]:to-[hsl(var(--imv-purple))] data-[state=active]:text-black data-[state=active]:shadow-md data-[state=active]:font-semibold"
              >
                <ShieldAlert className="mr-2 h-4 w-4" />
                Sospechosos
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
          <TabsContent value="tags" className="space-y-6">
            <TagsManagementTab />
          </TabsContent>
          <TabsContent value="sospechosos" className="space-y-6">
            <SuspiciousDevicesTab />
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