import Booking from "../models/Booking.js";

const generateBookingId = async () => {
  const lastBooking = await Booking.findOne({}, {}, { sort: { 'createdAt': -1 } });
  
  if (!lastBooking) {
    return 'BOOKING-0001';
  }

  const lastIdStr = lastBooking.bookingId;
  const match = lastIdStr.match(/BOOKING-(\d+)/);
  
  if (match && match[1]) {
    const nextNumber = parseInt(match[1], 10) + 1;
    const formattedNumber = nextNumber.toString().padStart(4, '0');
    return `BOOKING-${formattedNumber}`;
  }
  
  return `BOOKING-${Math.floor(1000 + Math.random() * 9000)}`;
};

export default generateBookingId;
