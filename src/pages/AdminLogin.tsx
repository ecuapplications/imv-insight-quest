import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // false = oculta por defecto

  useEffect(() => {
    // Check if already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/admin");
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        toast.success("Bienvenido al panel de administración");
        navigate("/admin");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Credenciales incorrectas");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--imv-cyan)/0.1)] to-[hsl(var(--imv-purple)/0.1)] p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] rounded-full flex items-center justify-center">
            <Lock className="h-6 w-6 text-black" />
          </div>
          <CardTitle className="text-2xl font-bold">Panel de Administración</CardTitle>
          <div className="py-4">
            <img 
              src="/logo.png" // Asegúrate de que este sea el nombre de tu archivo
              alt="Logotipo de IMV Health Digestive" 
              className="mx-auto h-16 w-auto" // Ajusta el tamaño aquí (h-16 = 4rem = 64px)
            />
          </div>
          <CardDescription>IMV Health Digestive - Sistema de Encuestas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
                              <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    {/* 1. Contenedor con posición relativa */}
                    <div className="relative">
                      <Input
                        id="password"
                        // 2. El tipo cambia según el estado 'showPassword'
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pr-10" // 3. Espacio a la derecha para el ícono
                      />
                      {/* 4. Botón posicionado a la derecha */}
                      <Button
                        type="button" // Importante para que no envíe el formulario
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-0 h-full px-3"
                        // 5. Al hacer clic, cambiamos el estado
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {/* 6. Muestra un ícono u otro según el estado */}
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-500" /> // Ojo tachado si se muestra
                        ) : (
                          <Eye className="h-4 w-4 text-gray-500" /> // Ojo normal si está oculta
                        )}
                      </Button>
                    </div>
                  </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[hsl(var(--imv-cyan))] to-[hsl(var(--imv-purple))] text-black font-semibold hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
