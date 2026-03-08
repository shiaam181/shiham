import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import {
  Bot, X, Send, Sparkles, Loader2,
  CalendarPlus, Receipt, Users, Clock, IndianRupee, CheckCircle2,
} from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };
type ActionMeta = { tool: string; args: Record<string, any> };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hr-assistant`;

const SUGGESTIONS = [
  "What's my leave balance?",
  "How many days was I present this month?",
  "Apply casual leave for tomorrow",
  "Explain my last payslip",
  "Tax saving tips for me",
];

const TOOL_LABELS: Record<string, { label: string; icon: typeof CalendarPlus; color: string }> = {
  apply_leave: { label: 'Leave Applied', icon: CalendarPlus, color: 'bg-green-500/10 text-green-600' },
  get_payslip_details: { label: 'Payslip Fetched', icon: Receipt, color: 'bg-blue-500/10 text-blue-600' },
  get_team_status: { label: 'Team Status', icon: Users, color: 'bg-purple-500/10 text-purple-600' },
  submit_regularization: { label: 'Regularization Submitted', icon: Clock, color: 'bg-amber-500/10 text-amber-600' },
  get_tax_saving_tips: { label: 'Tax Tips', icon: IndianRupee, color: 'bg-emerald-500/10 text-emerald-600' },
};

export default function HRAssistantChat() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actions, setActions] = useState<ActionMeta[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, actions]);

  const [followUps, setFollowUps] = useState<string[]>([]);

  const streamChat = async (allMessages: Msg[]) => {
    setFollowUps([]);
    setActions([]);
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: allMessages, userId: user?.id }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Error ${resp.status}`);
    }

    if (!resp.body) throw new Error('No response body');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let assistantSoFar = '';
    let streamDone = false;

    const processContent = (content: string) => {
      assistantSoFar += content;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    const parseLine = (line: string): boolean => {
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') return false;
      if (!line.startsWith('data: ')) return false;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') return true;
      try {
        const parsed = JSON.parse(jsonStr);
        // Check for action metadata
        if (parsed.action_meta) {
          setActions(parsed.action_meta);
          return false;
        }
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) processContent(content);
      } catch {
        return false;
      }
      return false;
    };

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        const line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (parseLine(line)) { streamDone = true; break; }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (const raw of textBuffer.split('\n')) {
        if (raw) parseLine(raw);
      }
    }

    // Generate follow-up suggestions
    generateFollowUps(assistantSoFar, allMessages);
  };

  const generateFollowUps = (lastAnswer: string, history: Msg[]) => {
    const lastUserMsg = history.filter(m => m.role === 'user').pop()?.content?.toLowerCase() || '';
    const isManager = role === 'manager' || role === 'admin' || role === 'developer' || role === 'owner' || role === 'hr';

    const suggestionSets: Record<string, string[]> = {
      leave: [
        "Apply casual leave for tomorrow",
        "What's the leave policy?",
        "Show my recent leave requests",
        "Can I carry forward my leaves?",
      ],
      attendance: [
        "Show my attendance this month",
        "What time did I check in today?",
        "Submit regularization for yesterday",
        "How many days was I absent?",
      ],
      payroll: [
        "Explain my latest payslip deductions",
        "Show my salary breakdown",
        "Give me tax saving tips",
        "How is PF calculated?",
      ],
      team: [
        "Who's absent today?",
        "Show team attendance summary",
        "Any pending leave approvals?",
        "Team availability this week",
      ],
      general: [
        "What's my leave balance?",
        "Show my attendance summary",
        "Explain my latest payslip",
        isManager ? "Show team status today" : "What are my work hours?",
      ],
    };

    let category = 'general';
    if (lastUserMsg.includes('leave') || lastUserMsg.includes('balance') || lastUserMsg.includes('holiday')) {
      category = 'leave';
    } else if (lastUserMsg.includes('attend') || lastUserMsg.includes('check in') || lastUserMsg.includes('present') || lastUserMsg.includes('absent') || lastUserMsg.includes('regulariz')) {
      category = 'attendance';
    } else if (lastUserMsg.includes('salary') || lastUserMsg.includes('pay') || lastUserMsg.includes('slip') || lastUserMsg.includes('deduction') || lastUserMsg.includes('tax')) {
      category = 'payroll';
    } else if (lastUserMsg.includes('team') || lastUserMsg.includes('who') || lastUserMsg.includes('member')) {
      category = isManager ? 'team' : 'general';
    }

    const pool = suggestionSets[category];
    const filtered = pool.filter(s => !history.some(m => m.content.toLowerCase() === s.toLowerCase()));
    const picked = filtered.sort(() => Math.random() - 0.5).slice(0, 3);
    setFollowUps(picked);
  };

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setIsLoading(true);

    try {
      await streamChat(updated);
    } catch (e: any) {
      toast({
        title: 'AI Assistant Error',
        description: e.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 sm:bottom-6 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group hover:scale-105"
          aria-label="Open HR Assistant"
        >
          <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background animate-pulse" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <Card className="fixed bottom-20 sm:bottom-6 right-4 z-50 w-[360px] sm:w-[400px] h-[520px] flex flex-col shadow-2xl border-border/80 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">HR Buddy</p>
                <p className="text-[10px] opacity-80">AI-powered • Multilingual • Smart Actions</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/20 h-8 w-8"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-3 py-3" ref={scrollRef as any}>
            <div className="space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-6 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Hi! I'm HR Buddy 👋</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      I can apply leave, explain payslips, show team status, and answer in your language!
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-left text-xs px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-foreground transition-colors border border-border/50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i}>
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>

                  {/* Show action badges after the last assistant message */}
                  {msg.role === 'assistant' && i === messages.length - 1 && actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5 ml-1">
                      {actions.map((action, ai) => {
                        const meta = TOOL_LABELS[action.tool];
                        if (!meta) return null;
                        const Icon = meta.icon;
                        return (
                          <Badge key={ai} variant="secondary" className={`text-[10px] gap-1 ${meta.color}`}>
                            <Icon className="w-3 h-3" />
                            {meta.label}
                            <CheckCircle2 className="w-3 h-3 ml-0.5" />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              {!isLoading && followUps.length > 0 && messages.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <p className="text-[10px] text-muted-foreground font-medium px-1">Suggested follow-ups</p>
                  {followUps.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-xs px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-foreground transition-colors border border-border/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-border/50 bg-card">
            <form
              onSubmit={e => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask me anything... (any language!)"
                className="flex-1 text-sm h-9 bg-muted/30"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        </Card>
      )}
    </>
  );
}
