import dns from "node:dns";
import { setDefaultAutoSelectFamily } from "node:net";

dns.setDefaultResultOrder("ipv4first");
if (typeof setDefaultAutoSelectFamily === "function") {
  setDefaultAutoSelectFamily(false);
}

