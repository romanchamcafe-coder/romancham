"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send } from "lucide-react";

type Msg = { role: "user" | "ai"; text: string };

export function AiChat({ suggestions }: { suggestions: string[] }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      setMsgs((m) => [...m, { role: "ai", text: data.reply || data.error || "Sorry, I couldn't answer that." }]);
    } catch {
      setMsgs((m) => [...m, { role: "ai", text: "Network error — please try again." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="font-semibold">Ask Romancham AI</h2>
        </div>

        {msgs.length > 0 && (
          <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <span className={"inline-block max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-sm " + (m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-card")}>{m.text}</span>
              </div>
            ))}
            {busy && <p className="text-sm text-muted-foreground">Analyzing your data…</p>}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about your restaurant…" aria-label="Ask Romancham AI" />
          <Button type="submit" disabled={busy || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} disabled={busy}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
