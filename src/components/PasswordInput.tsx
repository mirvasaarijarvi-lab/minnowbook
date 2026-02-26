import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Check, X, AlertTriangle, Shield } from "lucide-react";
import { validatePasswordSync, checkPasswordBreach, MIN_LENGTH } from "@/lib/password-validation";
import { useT } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

interface PasswordInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  placeholder?: string;
  showRequirements?: boolean;
  onValidChange?: (isValid: boolean) => void;
  className?: string;
}

const PasswordInput = ({
  id = "password",
  name,
  value,
  onChange,
  label,
  placeholder,
  showRequirements = true,
  onValidChange,
  className,
}: PasswordInputProps) => {
  const t = useT();
  const [showPassword, setShowPassword] = useState(false);
  const [breachResult, setBreachResult] = useState<{ isBreached: boolean; count: number } | null>(null);
  const [checkingBreach, setCheckingBreach] = useState(false);

  const validation = validatePasswordSync(value);

  // Debounced breach check
  useEffect(() => {
    if (value.length < MIN_LENGTH) {
      setBreachResult(null);
      return;
    }

    setCheckingBreach(true);
    const timer = setTimeout(async () => {
      const result = await checkPasswordBreach(value);
      setBreachResult(result);
      setCheckingBreach(false);
    }, 600);

    return () => {
      clearTimeout(timer);
      setCheckingBreach(false);
    };
  }, [value]);

  // Report validity upstream
  useEffect(() => {
    const isFullyValid = validation.isValid && (breachResult === null || !breachResult.isBreached);
    onValidChange?.(isFullyValid);
  }, [validation.isValid, breachResult, onValidChange]);

  const Indicator = ({ ok, text }: { ok: boolean; text: string }) => (
    <div className={cn("flex items-center gap-1.5 text-xs transition-colors", ok ? "text-primary" : "text-muted-foreground")}>
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {text}
    </div>
  );

  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder || `Min. ${MIN_LENGTH} characters`}
          value={value}
          onChange={onChange}
          minLength={MIN_LENGTH}
          required
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {showRequirements && value.length > 0 && (
        <div className="mt-2 space-y-1">
          <Indicator ok={validation.lengthOk} text={t("password.minLength")} />
          <Indicator ok={validation.hasUppercase} text={t("password.uppercase")} />
          <Indicator ok={validation.hasLowercase} text={t("password.lowercase")} />
          <Indicator ok={validation.hasNumber} text={t("password.number")} />

          {checkingBreach && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3 w-3 animate-pulse" />
              {t("password.checking")}
            </div>
          )}

          {breachResult?.isBreached && (
            <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
              <AlertTriangle className="h-3 w-3" />
              {t("password.breached")}
            </div>
          )}

          {breachResult && !breachResult.isBreached && validation.isValid && (
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <Shield className="h-3 w-3" />
              {t("password.safe")}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PasswordInput;
