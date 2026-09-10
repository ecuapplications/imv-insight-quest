import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import {
  isPushSupported,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pushSubscription";

const NotificationBell = () => {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    setSupported(true);
    setPermissionDenied(Notification.permission === "denied");
    getCurrentSubscription()
      .then((sub) => setSubscribed(!!sub))
      .catch((error) => console.error("Error checking push subscription:", error));
  }, []);

  if (!supported) return null;

  const handleClick = async () => {
    setLoading(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
        toast.success("Notificaciones desactivadas");
      } else {
        const ok = await subscribeToPush();
        if (ok) {
          setSubscribed(true);
          toast.success("Notificaciones activadas");
        } else {
          setPermissionDenied(Notification.permission === "denied");
          toast.error("No se pudo activar las notificaciones");
        }
      }
    } catch (error) {
      console.error("Error toggling push notifications:", error);
      toast.error("No se pudo actualizar las notificaciones");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading || permissionDenied}
      variant="outline"
      size="icon"
      title={
        permissionDenied
          ? "Notificaciones bloqueadas en el navegador"
          : subscribed
            ? "Desactivar notificaciones"
            : "Activar notificaciones"
      }
      className="shrink-0 border-gray-300"
    >
      {subscribed ? (
        <BellRing className="h-4 w-4 text-[hsl(var(--imv-cyan))]" />
      ) : permissionDenied ? (
        <BellOff className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
    </Button>
  );
};

export default NotificationBell;
