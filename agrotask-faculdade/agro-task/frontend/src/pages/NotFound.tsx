import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, AlertTriangle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-12 text-center">
          <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <h1 className="text-4xl font-bold mb-4 text-foreground">404</h1>
          <h2 className="text-xl font-semibold mb-2 text-foreground">Página não encontrada</h2>
          <p className="text-muted-foreground mb-6">
            A página que você está procurando não existe ou foi movida.
          </p>
          <Button asChild>
            <a href="/" className="inline-flex items-center">
              <Home className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
