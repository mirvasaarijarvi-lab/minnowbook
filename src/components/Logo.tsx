import logoColor from "@/assets/logo-color.png";
import logoNegative from "@/assets/logo-negative.png";
import logoBw from "@/assets/logo-bw.png";

interface LogoProps {
  variant?: "color" | "negative" | "bw";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const logoSrc = {
  color: logoColor,
  negative: logoNegative,
  bw: logoBw,
};

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

const textSizeClasses = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};

const Logo = ({ variant = "color", size = "md", showText = true, className = "" }: LogoProps) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={logoSrc[variant]}
        alt="MimmoBook logo"
        className={`${sizeClasses[size]} object-contain`}
      />
      {showText && (
        <span className={`${textSizeClasses[size]} font-serif font-semibold`}>
          Mimmo<span className="text-gradient">Book</span>
        </span>
      )}
    </div>
  );
};

export default Logo;
