import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { listNotifications, markNotificationRead, LocalLoopNotification } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

export const NotificationsMenu = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<LocalLoopNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const { toast } = useToast();

  const resolveNotificationPath = (notification: LocalLoopNotification): string | null => {
    const referenceId = (notification.reference_id || "").trim();
    if (!referenceId) {
      return null;
    }

    const referenceType = (notification.reference_type || "").toLowerCase();
    if (referenceType === "chat") {
      return `/chat?chatId=${encodeURIComponent(referenceId)}`;
    }
    if (referenceType === "product") {
      return `/listings/${encodeURIComponent(referenceId)}`;
    }

    const title = (notification.title || "").toLowerCase();
    if (title.includes("message") || title.includes("chat")) {
      return `/chat?chatId=${encodeURIComponent(referenceId)}`;
    }
    if (title.includes("offer") || title.includes("product")) {
      return `/listings/${encodeURIComponent(referenceId)}`;
    }

    return null;
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await listNotifications();
        setNotifications(data);
        setHasLoadError(false);
      } catch (error) {
        if (!hasLoadError) {
          toast({
            title: "Notifications unavailable",
            description: "Unable to load notifications right now.",
            variant: "destructive",
          });
          setHasLoadError(true);
        }
      }
    };

    if (isOpen) {
      void fetchNotifications();
    } else {
      void fetchNotifications();
      const interval = setInterval(() => void fetchNotifications(), 30000);
      return () => clearInterval(interval);
    }
  }, [hasLoadError, isOpen, toast]);

  const handleMarkRead = async (id: string, currentlyRead: boolean) => {
    if (currentlyRead) {
      return;
    }
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      toast({
        title: "Error",
        description: "Failed to mark notification as read.",
        variant: "destructive",
      });
    }
  };

  const handleNotificationClick = async (notification: LocalLoopNotification) => {
    await handleMarkRead(notification.notification_id, notification.is_read);
    const destination = resolveNotificationPath(notification);
    if (!destination) {
      return;
    }
    setIsOpen(false);
    navigate(destination);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-[10px] top-[10px] flex h-[6px] w-[6px] rounded-full bg-red-500"></span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="font-semibold">Notifications</h4>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {unreadCount} unread
          </span>
        </div>
        <div className="flex max-h-80 flex-col overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.notification_id}
                onClick={() => void handleNotificationClick(notification)}
                className={`flex cursor-pointer flex-col gap-1 border-b px-4 py-3 transition-colors hover:bg-secondary/50 ${
                  !notification.is_read ? "bg-accent/10" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-sm font-medium ${!notification.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                    {notification.title}
                  </span>
                  {!notification.is_read && (
                    <span className="mt-1.5 flex h-2 w-2 shrink-0 rounded-full bg-primary"></span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground line-clamp-2">
                  {notification.message}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
