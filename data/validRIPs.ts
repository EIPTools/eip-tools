import _validRIPs from "@/data/valid-rips.json";
import { ValidEIPs } from "@/types";

export const validRIPs = _validRIPs as ValidEIPs;

export const validRIPsArray = Object.keys(validRIPs);
