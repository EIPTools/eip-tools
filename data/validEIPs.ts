import _validEIPs from "@/data/valid-eips.json";
import { ValidEIPs } from "@/types";

export const validEIPs: ValidEIPs = _validEIPs;

export const validEIPsArray = Object.keys(validEIPs);
