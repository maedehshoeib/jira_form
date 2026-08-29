import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";
import { assetUrl } from "../lib/assetUrl";
import ThemeToggle from "../components/ThemeToggle";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loggedInUser = await login(username, password);
      navigate(
        loggedInUser.must_change_password
          ? "/change-password"
          : loggedInUser.is_admin && from === "/"
            ? "/admin/dashboard"
            : from,
        { replace: true }
      );
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.detail ||
          "نام کاربری یا رمز عبور اشتباه است"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 font-sans"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.10),transparent_32%),radial-gradient(circle_at_bottom_left,hsl(var(--muted)),transparent_38%)]" />
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <ThemeToggle />
      </div>

      <Card className="relative w-full max-w-md gap-0 overflow-hidden border-border/80 py-0 shadow-2xl shadow-foreground/5">
        <CardHeader className="flex flex-col items-center border-b bg-muted/30 px-8 py-8 text-center">
          <img src={assetUrl(logo)} alt="وثوق گستر" className="mb-4 h-20 object-contain" />
          <CardTitle className="text-2xl font-bold text-foreground">سامانه جامع خدمات</CardTitle>
          <CardDescription className="mt-2 leading-6">
            با نام کاربری و رمز عبور سیستم سازمانی وارد شوید
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8">
          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription className="text-destructive">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="mb-2 block text-sm font-medium text-foreground">
              نام کاربری
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: f.amiri"
              required
              className="h-12 rounded-xl"
            />
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium text-foreground">
              رمز عبور
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="رمز عبور"
              required
              className="h-12 rounded-xl"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full text-base"
          >
            <LogIn size={18} />
            {loading ? "در حال ورود..." : "ورود به سامانه"}
          </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            در اولین ورود، تغییر رمز عبور پیش‌فرض الزامی است.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
