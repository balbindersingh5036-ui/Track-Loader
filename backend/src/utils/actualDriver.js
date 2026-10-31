import User from "../models/User.js";

export const getActualDriverUserFilter = async () => {
  const driverUsers = await User.find({ role: "driver" }).select("_id").lean();
  return { user: { $in: driverUsers.map(({ _id }) => _id) } };
};

export const isActualDriverProfile = async (driver) => {
  const user = driver?.user;
  if (!user) return false;
  if (typeof user === "object" && user.role) return user.role === "driver";

  const linkedUser = await User.findById(user).select("role").lean();
  return linkedUser?.role === "driver";
};
