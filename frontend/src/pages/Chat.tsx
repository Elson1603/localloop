import { SendHorizontal } from "lucide-react";
import { useState } from "react";
import { MarketNavbar } from "@/components/localloop/MarketNavbar";
import { PageShell } from "@/components/localloop/PageShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chatMessages } from "@/data/mockData";

const Chat = () => {
  const [message, setMessage] = useState("");

  return (
    <div className="min-h-screen">
      <MarketNavbar />
      <PageShell>
        <div className="glass grid min-h-[72vh] rounded-2xl md:grid-cols-[280px_1fr]">
          <aside className="border-b border-border/70 p-4 md:border-b-0 md:border-r">
            <h2 className="mb-4 text-lg font-semibold">Chats</h2>
            <div className="space-y-2">
              {[
                "Aarav Sharma",
                "Priya Nair",
                "Neel Shah",
              ].map((name, i) => (
                <button key={name} className={`w-full rounded-xl p-3 text-left transition-smooth ${i === 0 ? "bg-secondary" : "hover:bg-secondary/70"}`}>
                  <p className="font-medium">{name}</p>
                  <p className="text-sm text-muted-foreground">Typing...</p>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex flex-col">
            <div className="border-b border-border/70 p-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src="https://i.pravatar.cc/100?img=12" alt="Aarav" />
                  <AvatarFallback>AS</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">Aarav Sharma</p>
                  <p className="text-sm text-accent">typing...</p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2 ${msg.fromMe ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                    <p className="text-sm">{msg.text}</p>
                    <p className={`mt-1 text-[11px] ${msg.fromMe ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>

            <form className="flex gap-2 border-t border-border/70 p-3" onSubmit={(e) => e.preventDefault()}>
              <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message..." className="rounded-full" />
              <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </form>
          </section>
        </div>
      </PageShell>
    </div>
  );
};

export default Chat;
