import Razorpay from "razorpay";
import { env } from "./env.js";

const razorpayInstance = new Razorpay({
  key_id: env.razorpay.keyId,
  key_secret: env.razorpay.keySecret
});

export default razorpayInstance;
