import _validRIPs from "@/data/valid-rips.json";
import { ValidEIPs } from "@/types";

export const validRIPs: ValidEIPs = _validRIPs;

export const validRIPsArray = Object.keys(validRIPs);
