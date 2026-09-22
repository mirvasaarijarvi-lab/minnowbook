import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Every notice gets a close control, so a notification can always be
      // dismissed instead of sitting over the button underneath it.
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast data-[removed=true]:pointer-events-none data-[visible=false]:pointer-events-none group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

// `toast` is re-exported from "sonner" directly by callers, so this module only
// exports the component. See docs/linting-policy.md.
export { Toaster };
