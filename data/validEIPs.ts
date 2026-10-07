import _validEIPs from "@/data/valid-eips.json";
import { ValidEIPs } from "@/types";

// JSON imports widen lifecycle string literals; the generated index contract
// is exercised by proposal source tests.
export const validEIPs = _validEIPs as ValidEIPs;

export const validEIPsArray = Object.keys(validEIPs);
