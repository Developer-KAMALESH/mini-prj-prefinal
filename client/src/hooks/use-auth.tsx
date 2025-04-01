import { useContext } from "react";
import { AuthContext } from "@/App";

export function useAuth() {
  return useContext(AuthContext);
}