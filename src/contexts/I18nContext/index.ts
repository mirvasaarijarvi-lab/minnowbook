// Barrel so existing "@/contexts/I18nContext" imports keep working while the
// context object, hooks and provider live in separate modules.
// See docs/linting-policy.md.
export {
  I18nContext,
  useI18n,
  useT,
  useTDynamic,
  useLanguage,
  type I18nContextType,
} from "./context";
export { I18nProvider } from "./I18nProvider";
