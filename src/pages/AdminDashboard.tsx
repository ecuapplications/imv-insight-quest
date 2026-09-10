import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, BarChart3, Kanban, Tag, ShieldAlert, Link2, Menu, MessageSquareText } from "lucide-react";
import StatsTab from "@/components/admin/StatsTab";
import KanbanTab from "@/components/admin/KanbanTab";
import ComentariosTab from "@/components/admin/ComentariosTab";
import TagsManagementTab from "@/components/admin/TagsManagementTab";
import SuspiciousDevicesTab from "@/components/admin/SuspiciousDevicesTab";
import GenerateLinkTab from "@/components/admin/GenerateLinkTab";
import { logout, isAuthenticated, getRole } from "@/lib/api";

const TABS = [
  { value: "comentarios", label: "Comentarios", shortLabel: "Comentarios", icon: MessageSquareText },
  { value: "stats", label: "Estadísticas", shortLabel: "Stats", icon: BarChart3 },
  { value: "kanban", label: "Gestión de Comentarios", shortLabel: "Kanban", icon: Kanban },
  { value: "tags", label: "Gestión de Etiquetas", shortLabel: "Tags", icon: Tag },
  { value: "sospechosos", label: "Sospechosos", shortLabel: "Alertas", icon: ShieldAlert },
  { value: "enlaces", label: "Enlaces", shortLabel: "Enlaces", icon: Link2 },
] as const;

const SWIPE_THRESHOLD_PX = 60;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const role = getRole();
  // El rol "recepcion" solo puede ver y usar la pestaña de Enlaces.
  const visibleTabs = role === "recepcion" ? TABS.filter((t) => t.value === "enlaces") : TABS;
  const [activeTab, setActiveTab] = useState(role === "recepcion" ? "enlaces" : "comentarios");
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin-login");
    }
  }, [navigate]);

  const handleLogout = () => {
    logout();
    window.location.href = "/admin-login";
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Ignorar si el gesto fue más vertical que horizontal (scroll normal)
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) return;

    const currentIndex = visibleTabs.findIndex((t) => t.value === activeTab);
    if (currentIndex === -1) return;

    if (deltaX < 0 && currentIndex < visibleTabs.length - 1) {
      setActiveTab(visibleTabs[currentIndex + 1].value);
    } else if (deltaX > 0 && currentIndex > 0) {
      setActiveTab(visibleTabs[currentIndex - 1].value);
    }
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="min-h-screen bg-[hsl(var(--kanban-bg))] flex flex-col"
    >
      <div className="flex-grow">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <img
                src="/logo.png"
                alt="Logotipo de IMV Health Digestive"
                className="h-12 md:h-16 w-auto"
              />
              <p className="hidden md:block text-sm text-[hsl(var(--imv-gray))] mt-1">
                Panel de Administración de Encuestas
              </p>
            </div>

            {/* Pestañas: visibles como tabs horizontales solo en pantallas medianas+ */}
            <TabsList className="hidden md:flex p-1 h-auto bg-gray-100 rounded-lg">
              {visibleTabs.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="px-4 py-2 text-muted-foreground rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--imv-cyan))] data-[state=active]:to-[hsl(var(--imv-purple))] data-[state=active]:text-black data-[state=active]:shadow-md data-[state=active]:font-semibold"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Cerrar sesión: botón completo en desktop */}
            <Button
              onClick={handleLogout}
              variant="outline"
              className="hidden md:inline-flex border-gray-300 hover:bg-gray-100"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>

            {/* Menú hamburguesa: solo en mobile, para acciones secundarias */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-11 w-11 shrink-0"
                  aria-label="Abrir menú"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleLogout} className="py-3">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content */}
        <div
          className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {visibleTabs.some((t) => t.value === "comentarios") && (
            <TabsContent value="comentarios" className="space-y-6">
              <ComentariosTab />
            </TabsContent>
          )}
          {visibleTabs.some((t) => t.value === "stats") && (
            <TabsContent value="stats" className="space-y-6">
              <StatsTab />
            </TabsContent>
          )}
          {visibleTabs.some((t) => t.value === "kanban") && (
            <TabsContent value="kanban" className="space-y-6">
              <KanbanTab />
            </TabsContent>
          )}
          {visibleTabs.some((t) => t.value === "tags") && (
            <TabsContent value="tags" className="space-y-6">
              <TagsManagementTab />
            </TabsContent>
          )}
          {visibleTabs.some((t) => t.value === "sospechosos") && (
            <TabsContent value="sospechosos" className="space-y-6">
              <SuspiciousDevicesTab />
            </TabsContent>
          )}
          <TabsContent value="enlaces" className="space-y-6">
            <GenerateLinkTab />
          </TabsContent>
        </div>
      </div>

      {/* Barra de navegación inferior: solo en mobile, estilo app nativa (oculta si solo hay 1 pestaña visible) */}
      <nav
        hidden={visibleTabs.length <= 1}
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}>
          {visibleTabs.map(({ value, shortLabel, icon: Icon }) => {
            const isActive = activeTab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 transition-colors ${
                  isActive ? "text-[hsl(var(--imv-cyan))]" : "text-gray-400"
                }`}
                aria-label={shortLabel}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={`h-6 w-6 ${isActive ? "scale-110" : ""} transition-transform`} />
                <span className={`text-[10px] leading-none ${isActive ? "font-semibold" : ""}`}>
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer: oculto en mobile para no competir con la barra inferior */}
      <footer className="hidden md:block text-center py-4 text-xs text-gray-500">
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
