import { useNavigate } from "react-router-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { openDirectConversation } from "@/lib/messaging";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props extends Omit<ButtonProps, "onClick"> {
  recipientId: string;
  label?: string;
}

export function MessageButton({ recipientId, label = "Message", ...btn }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const open = async () => {
    if (!user) { toast.error("Sign in to message"); return; }
    if (user.id === recipientId) return;
    const cid = await openDirectConversation(recipientId);
    if (!cid) return toast.error("Could not open conversation");
    navigate(`/messages?c=${cid}`);
  };

  return (
    <Button {...btn} onClick={open}>
      <MessageSquare className="h-4 w-4 mr-2" />{label}
    </Button>
  );
}
