import _validCAIPs from "@/data/valid-caips.json";
import { ValidEIPs } from "@/types";

export const validCAIPs: ValidEIPs = _validCAIPs;

export const validCAIPsArray = Object.keys(validCAIPs);
