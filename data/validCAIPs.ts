import _validCAIPs from "@/data/valid-caips.json";
import { ValidEIPs } from "@/types";

export const validCAIPs = _validCAIPs as ValidEIPs;

export const validCAIPsArray = Object.keys(validCAIPs);
