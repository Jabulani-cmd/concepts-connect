import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LanguageSelect from "@/components/LanguageSelect";
import { portalHomeFor } from "@/lib/portalHome";
import schoolLogo from "@/assets/concepts-logo.png";

/** Navigation bar for portal pages that do not have their own header. */
export default function PortalTopBar() {
  const { role } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
      <div className="container flex h-14 items-center justify-between gap-3 px-3 sm:px-4">
        <Link to={portalHomeFor(role)} className="flex min-w-0 items-center gap-2">
          <img src={schoolLogo} alt="" className="h-10 w-10 object-contain" />
          <span className="truncate font-heading text-sm font-bold text-primary sm:text-base">Concepts Learning Academy</span>
        </Link>
        <LanguageSelect />
      </div>
    </header>
  );
}
