import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import MessagingPanel from "@/components/MessagingPanel";
import PortalTopBar from "@/components/layout/PortalTopBar";

interface Props {
  children: ReactNode;
  /** Adds the portal navigation bar, for pages that have no header of their own. */
  topBar?: boolean;
}

export default function AuthenticatedLayout({ children, topBar = false }: Props) {
  const { user } = useAuth();

  return (
    <>
      {topBar && <PortalTopBar />}
      {children}
      {user && <MessagingPanel />}
    </>
  );
}
