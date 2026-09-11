import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Link, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Operations, { AuthPanel } from "./pages/Operations";
import { trpc } from "./lib/trpc";
import { Loader2 } from "lucide-react";

function AuthenticatedHome() {
  const me = trpc.operations.auth.me.useQuery(undefined, { retry: false });

  if (me.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080d1a]">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
      </div>
    );
  }

  return me.data ? <Home /> : <AuthPanel />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthenticatedHome} />
      <Route path="/operations" component={Operations} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors theme="dark" />
          <Router />
          <Link
            href="/operations"
            className="fixed bottom-4 right-4 z-50 rounded-lg border border-cyan-300/30 bg-[#101a31] px-4 py-3 text-xs font-bold text-cyan-100 shadow-xl transition hover:border-cyan-300/60 hover:bg-[#15223d]"
          >
            Open operations portal
          </Link>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
